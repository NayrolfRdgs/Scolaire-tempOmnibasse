@echo off
echo ============================================
echo   Omnibasse - Frontend (mode developpement)
echo ============================================
echo.

cd /d G:\.Pro\.Dev\Lycee\OM\frontend

:: Verifier que node_modules est present
if not exist "node_modules" (
    echo [INFO] Installation des dependances npm...
    npm install
    echo.
)

echo [INFO] Lancement du frontend Vite sur http://localhost:5173
echo [INFO] Le backend doit etre lance sur http://localhost:8000
echo.

npm run dev

pause
