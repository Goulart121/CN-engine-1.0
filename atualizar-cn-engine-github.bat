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
  echo Este projeto ainda nao foi iniciado como repositorio Git.
  echo Rode primeiro publicar-cn-engine-github.bat.
  pause
  exit /b 1
)

set "REMOTE_URL="
for /f "usebackq delims=" %%i in (`"%GIT_EXE%" remote get-url origin 2^>nul`) do set "REMOTE_URL=%%i"
if not defined REMOTE_URL (
  echo O remote origin ainda nao foi configurado.
  echo Rode primeiro publicar-cn-engine-github.bat.
  pause
  exit /b 1
)

set "WORKTREE_STATUS="
for /f "usebackq delims=" %%i in (`"%GIT_EXE%" status --porcelain`) do set "WORKTREE_STATUS=dirty"
if defined WORKTREE_STATUS (
  echo Existem alteracoes locais nao commitadas.
  echo Faca commit ou backup antes de atualizar do GitHub.
  pause
  exit /b 1
)

echo Buscando atualizacoes do GitHub...
call "%GIT_EXE%" pull --ff-only origin main
if errorlevel 1 (
  echo Falha ao atualizar. Verifique conexao, branch e permissao no repositorio.
  pause
  exit /b 1
)

if exist "package.json" (
  echo.
  echo Sincronizando dependencias...
  call npm.cmd install
)

echo.
echo Projeto atualizado com sucesso.
pause
exit /b 0
