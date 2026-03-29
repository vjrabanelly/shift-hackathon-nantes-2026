from typing import List, Optional
from pydantic import BaseModel

class Feature(BaseModel):
    id: str
    name: str
    description: str

class TextRequest(BaseModel):
    content: str

class PodcastScriptLine(BaseModel):
    speaker: str
    content: str = ""
    text: str = ""

    def model_post_init(self, __context):
        """Unifie text et content — le prompt peut renvoyer l'un ou l'autre."""
        if self.text and not self.content:
            self.content = self.text
        elif self.content and not self.text:
            self.text = self.content

class PodcastScript(BaseModel):
    title: str
    lines: List[PodcastScriptLine]

class PodcastResponse(BaseModel):
    title: str
    audio_url: str
    script: List[PodcastScriptLine]
    duration_estimate: str

class Exercise(BaseModel):
    question: str
    options: list[str]
    answer: str  # A, B, C ou D
    explanation: str

class ExercisesResponse(BaseModel):
    questions: list[Exercise]

class JobResponse(BaseModel):
    job_id: str

class JobStatusResponse(BaseModel):
    job_id: str
    status: str
    result: Optional[PodcastResponse] = None
    error: Optional[str] = None
