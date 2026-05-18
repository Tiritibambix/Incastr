import os

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.dependencies import get_current_user
from backend.core.exceptions import bad_request, not_found
from backend.database import get_db
from backend.models.folder import Folder
from backend.models.user import User
from backend.schemas.folder import FolderCreate, FolderOut, FolderUpdate

router = APIRouter(prefix="/api/folders", tags=["folders"])


@router.get("", response_model=list[FolderOut])
async def list_folders(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Folder).where(Folder.user_id == current_user.id))
    return list(result.scalars().all())


@router.post("", response_model=FolderOut, status_code=status.HTTP_201_CREATED)
async def create_folder(
    body: FolderCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not os.path.isdir(body.path) or not os.access(body.path, os.R_OK):
        raise bad_request("Path does not exist or is not readable")
    folder = Folder(user_id=current_user.id, path=body.path, label=body.label)
    db.add(folder)
    await db.flush()
    return folder


@router.patch("/{folder_id}", response_model=FolderOut)
async def update_folder(
    folder_id: str,
    body: FolderUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Folder).where(Folder.id == folder_id, Folder.user_id == current_user.id)
    )
    folder = result.scalar_one_or_none()
    if not folder:
        raise not_found("Folder not found")
    if body.path is not None:
        if not os.path.isdir(body.path) or not os.access(body.path, os.R_OK):
            raise bad_request("Path does not exist or is not readable")
        folder.path = body.path
    if body.label is not None:
        folder.label = body.label
    return folder


@router.delete("/{folder_id}", status_code=204)
async def delete_folder(
    folder_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Folder).where(Folder.id == folder_id, Folder.user_id == current_user.id)
    )
    folder = result.scalar_one_or_none()
    if not folder:
        raise not_found("Folder not found")
    await db.delete(folder)
