@echo off
setlocal
cd /d "%~dp0"

set "GIT_EXE=C:\Program Files\Git\cmd\git.exe"
if exist "%GIT_EXE%" goto git_ok

set "GIT_EXE=git"
where git >nul 2>&1
if errorlevel 1 (
  echo Git nao foi encontrado neste computador.
  pause
  exit /b 1
)
:git_ok

if not exist ".git" (
  call "%GIT_EXE%" init -b main
  if errorlevel 1 (
    echo Falha ao iniciar o repositorio Git.
    pause
    exit /b 1
  )
)

call "%GIT_EXE%" branch -M main >nul 2>&1

set "REMOTE_URL="
for /f "usebackq delims=" %%i in (`"%GIT_EXE%" remote get-url origin 2^>nul`) do set "REMOTE_URL=%%i"
if not defined REMOTE_URL (
  echo.
  set /p REMOTE_URL=Cole a URL do repositorio GitHub ^(ex: https://github.com/usuario/cn-engine.git^): 
  if not defined REMOTE_URL (
    echo Nenhuma URL informada. Publicacao cancelada.
    pause
    exit /b 1
  )
  call "%GIT_EXE%" remote add origin "%REMOTE_URL%"
  if errorlevel 1 (
    echo Nao foi possivel adicionar o remote origin.
    pause
    exit /b 1
  )
)

call "%GIT_EXE%" add .
if errorlevel 1 (
  echo Falha ao preparar arquivos para commit.
  pause
  exit /b 1
)

call "%GIT_EXE%" diff --cached --quiet
if errorlevel 1 (
  set "COMMIT_MSG=Atualiza CN Engine"
  set /p COMMIT_MSG=Mensagem do commit ^(Enter para usar "Atualiza CN Engine"^): 
  if not defined COMMIT_MSG set "COMMIT_MSG=Atualiza CN Engine"
  call "%GIT_EXE%" commit -m "%COMMIT_MSG%"
  if errorlevel 1 (
    echo Falha ao criar o commit.
    pause
    exit /b 1
  )
) else (
  echo Nenhuma alteracao nova para commit.
)

echo.
echo Enviando para GitHub...
call "%GIT_EXE%" push -u origin main
if errorlevel 1 (
  echo Falha no push. Confira a URL do repositorio e seu login no GitHub.
  pause
  exit /b 1
)

echo.
echo CN Engine publicada/atualizada com sucesso no GitHub.
pause
exit /b 0
