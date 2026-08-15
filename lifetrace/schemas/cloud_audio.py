from pydantic import BaseModel, Field


class CloudAudioUploadRequest(BaseModel):
    filename: str = Field(min_length=1, max_length=120)
    content_type: str = Field(pattern=r"^audio/")


class CloudAudioUploadResponse(BaseModel):
    task_id: str
    object_key: str
    upload_url: str


class CloudTranscriptionResponse(BaseModel):
    task_id: str
    status: str
    text: str | None = None
    error: str | None = None


class CloudTranscriptionRequest(BaseModel):
    task_id: str = Field(min_length=16, max_length=64)
