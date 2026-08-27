@echo off
cd /d "%~dp0windows-demo"
start "" "http://127.0.0.1:8080"
py -m http.server 8080 --bind 127.0.0.1
