"""
models.py — Pydantic request / response schemas
"""

from typing import Optional
from pydantic import BaseModel, Field


class AskRequest(BaseModel):
    prompt: str = Field(
        ..., min_length=1, max_length=4000,
        description="The prompt to send to ChatGPT",
    )
    new_chat: bool = Field(
        False, description="If true, start a new chat instead of continuing the previous one",
    )


class AskResponse(BaseModel):
    status: str = Field(
        ..., description="'ok' on success, 'error' on failure",
    )
    response: Optional[str] = Field(
        None, description="The full ChatGPT response text",
    )
    error: Optional[str] = Field(
        None, description="Error message (only present when status='error')",
    )
