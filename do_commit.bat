@echo off
set GIT=C:\Users\jorge\AppData\Local\Programs\MinGit\cmd\git.exe
set REPO=C:\Users\jorge\Documents\antigravity\delightful-borg
%GIT% -C "%REPO%" add -A
%GIT% -C "%REPO%" commit -m "feat: mini-player controls, video canvas, icon fix"
