@echo off
git init
git add .
git commit -m "Debufs show in match history"
git branch -M main
git remote add origin https://github.com/Bor-S/PingpongTracker.git
git push -u origin main
pause
