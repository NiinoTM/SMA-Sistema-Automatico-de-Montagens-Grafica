@echo off
echo Creating folder for your project files...
mkdir "%~dp0FilesForElectron" 2>nul

echo Searching for HTML, CSS, and JS files...
dir /s /b *.html *.css *.js | findstr /v /i "\\node_modules\\ \\build\\ \\.git\\" > filelist.txt

echo Copying files...
for /F "delims=" %%i in (filelist.txt) do (
    copy "%%i" "%~dp0FilesForElectron\"
)

del filelist.txt
echo Done! Files are ready in FilesForElectron folder
pause