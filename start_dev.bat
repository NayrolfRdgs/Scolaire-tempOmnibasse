@echo off
echo ============================================
echo   Omnibasse - Backend (mode developpement)
echo ============================================
echo.

cd /d G:\.Pro\.Dev\Lycee\OM\backend

:: Activer le virtualenv si present
if exist ".venv\Scripts\activate.bat" (
    echo [INFO] Activation du virtualenv...
    call .venv\Scripts\activate.bat
) else (
    echo [WARN] Pas de virtualenv trouve. Utilisation du Python global.
    echo [HINT] Creez-en un avec: python -m venv .venv
)

echo [INFO] Lancement du backend FastAPI sur http://127.0.0.1:8000
echo [INFO] Documentation API : http://127.0.0.1:8000/docs
echo.

python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload

pause
