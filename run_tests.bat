@echo off
cd /d "%~dp0"
node --check windows-demo\terrain-engine.js || exit /b 1
node --check windows-demo\app.js || exit /b 1
node tests\test_terrain_engine.js || exit /b 1
py tests\verify_package.py || exit /b 1
echo.
echo All portable checks passed.
