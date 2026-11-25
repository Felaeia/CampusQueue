@echo off
setlocal
pushd "%~dp0" || exit /b 1
call npm.cmd run migrate -- --interactive
set "migration_exit_code=%ERRORLEVEL%"
popd
exit /b %migration_exit_code%
