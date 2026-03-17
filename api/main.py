"""
Regeneration API -- FastAPI wrapper around the programming pipeline.

Deployed on Railway. Called by the frontend when a coach clicks "Regenerate Workout".
Runs the full pipeline (ingest -> phase detect -> load config -> generate -> write)
and returns the new program ID.
"""

import os
import sys
import uuid
import traceback
from pathlib import Path

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel

_tools_dir = str(Path(__file__).resolve().parent.parent / "tools")
if _tools_dir not in sys.path:
    sys.path.insert(0, _tools_dir)

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parent.parent / ".env")
except ImportError:
    pass

from normalize_one_member import (
    get_supabase,
    fetch_exercise_library,
    fetch_results_for_member,
    normalize,
)
from detect_phase import detect_phase_for_member
from load_rules import load_config
from generate_program import generate_next_program, detect_sessions_per_week

app = FastAPI(title="Programming Engine API", version="1.0.0")

ALLOWED_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:5180,http://localhost:5173").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in ALLOWED_ORIGINS],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

security = HTTPBearer()
API_SECRET = os.getenv("API_SECRET", "")


def verify_api_key(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not API_SECRET:
        raise HTTPException(status_code=500, detail="API_SECRET not configured on server")
    if credentials.credentials != API_SECRET:
        raise HTTPException(status_code=401, detail="Invalid API key")
    return credentials


class RegenerateRequest(BaseModel):
    member_id: str
    scheme_name: str = "GPP"
    rep_range: str | None = None
    sessions_per_week: int | None = None
    duration_weeks: int = 6
    requested_by: str | None = None
    program_id: str | None = None


class RegenerateResponse(BaseModel):
    status: str
    program_id: str
    run_id: str
    scheme_name: str
    rep_range: str | None
    phase_number: int | None
    sessions_per_week: int
    duration_weeks: int
    message: str


@app.get("/health")
async def health():
    return {"status": "ok", "service": "programming-engine-api"}


@app.post("/regenerate", response_model=RegenerateResponse)
async def regenerate(req: RegenerateRequest, _creds=Depends(verify_api_key)):
    sb = get_supabase()
    run_id = str(uuid.uuid4())
    regen_row_id = None

    try:
        regen_insert = sb.table("programming_regeneration_requests").insert({
            "member_id": req.member_id,
            "program_id": req.program_id,
            "requested_by": req.requested_by,
            "scheme_name": req.scheme_name,
            "rep_range": req.rep_range or "",
            "sessions_per_week": req.sessions_per_week or 3,
            "status": "processing",
        }).execute()
        if regen_insert.data:
            regen_row_id = regen_insert.data[0]["id"]
    except Exception:
        pass

    try:
        rows = fetch_results_for_member(sb, req.member_id)
        if not rows:
            _fail_regen(sb, regen_row_id)
            raise HTTPException(status_code=404, detail=f"No training history for member {req.member_id}")

        exercise_lib = fetch_exercise_library(sb)
        past = normalize(rows, exercise_lib)
        sessions = past["sessions"]

        detected_spw = detect_sessions_per_week(sessions)
        spw = req.sessions_per_week or detected_spw

        phase = detect_phase_for_member(sb, req.member_id, req.scheme_name, sessions)

        # Coach override: if a rep_range was explicitly selected, use it
        # instead of the auto-detected next phase.
        rep_range_override = req.rep_range
        if rep_range_override:
            phase["next_rep_range"] = rep_range_override
            phase["coach_override"] = True

        config = load_config(sb, member_id=req.member_id, scheme_name=req.scheme_name)

        program = generate_next_program(
            sessions,
            exercise_lib,
            phase,
            config,
            sessions_per_week=spw,
        )

        changes = []
        if rep_range_override:
            changes.append(f"Rep range overridden to {rep_range_override} (auto-detected was {phase.get('current_rep_range')})")
        else:
            changes.append(
                f"Phase detection: {phase.get('current_rep_range')} -> "
                f"{phase.get('next_rep_range')} (confidence: {phase.get('confidence')})"
            )
        if req.sessions_per_week and req.sessions_per_week != detected_spw:
            changes.append(f"Sessions/week changed from {detected_spw} to {req.sessions_per_week}")

        final_rep_range = rep_range_override or phase.get("next_rep_range")

        program["metadata"] = {
            "run_id": run_id,
            "member_id": req.member_id,
            "scheme": req.scheme_name,
            "current_rep_range": phase.get("current_rep_range"),
            "next_rep_range": final_rep_range,
            "phase_order": phase.get("next_order"),
            "confidence": phase.get("confidence"),
            "exercise_behavior": phase.get("exercise_behavior"),
            "sessions_per_week": spw,
            "duration_weeks": req.duration_weeks,
            "coach_override": bool(rep_range_override),
        }

        rules_applied = list(config["rules"].keys())

        gen_row = {
            "run_id": run_id,
            "member_id": req.member_id,
            "assigned_to": req.requested_by,
            "sessions_per_week": spw,
            "duration_weeks": req.duration_weeks,
            "phase_number": phase.get("next_order"),
            "scheme_name": req.scheme_name,
            "rep_range": final_rep_range,
            "changes_summary": " | ".join(changes),
            "rules_applied": rules_applied,
            "payload": program,
        }
        result = sb.table("programming_generated").insert(gen_row).execute()
        new_program_id = result.data[0]["id"] if result.data else run_id

        if regen_row_id:
            sb.table("programming_regeneration_requests").update({
                "status": "completed",
                "completed_at": "now()",
            }).eq("id", regen_row_id).execute()

        return RegenerateResponse(
            status="completed",
            program_id=new_program_id,
            run_id=run_id,
            scheme_name=req.scheme_name,
            rep_range=final_rep_range,
            phase_number=phase.get("next_order"),
            sessions_per_week=spw,
            duration_weeks=req.duration_weeks,
            message=f"Generated {len(program.get('sessions', []))} day program",
        )

    except HTTPException:
        raise
    except Exception as e:
        _fail_regen(sb, regen_row_id)
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Pipeline failed: {str(e)}")


def _fail_regen(sb, regen_row_id: str | None):
    if regen_row_id:
        try:
            sb.table("programming_regeneration_requests").update({
                "status": "failed",
                "completed_at": "now()",
            }).eq("id", regen_row_id).execute()
        except Exception:
            pass
