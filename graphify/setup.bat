@echo off
setlocal EnableExtensions EnableDelayedExpansion

echo ===================================================
echo     OPENCODE SECOND-BRAIN SETUP FOR WINDOWS
echo ===================================================
echo.

:: -------------------------------------------------------
:: Source templates
:: -------------------------------------------------------
set "SOURCE=C:\Users\corte\Documents\do not delete second brain"

:: -------------------------------------------------------
:: Prompt for target project path
:: -------------------------------------------------------
set /p "TARGET_PATH=Enter or paste your project directory path: "

:: Remove surrounding quotes (Explorer drag-and-drop)
set "TARGET_PATH=%TARGET_PATH:"=%"

:: Remove trailing backslash
if "%TARGET_PATH:~-1%"=="\" set "TARGET_PATH=%TARGET_PATH:~0,-1%"

:: -------------------------------------------------------
:: Validate target path
:: -------------------------------------------------------
if not exist "%TARGET_PATH%" (
    echo.
    echo [ERROR] "%TARGET_PATH%" does not exist.
    pause
    exit /b 1
)

echo.
echo [1/5] Target:
echo    %TARGET_PATH%

:: -------------------------------------------------------
:: Create required directories
:: -------------------------------------------------------
echo.
echo [2/5] Creating required directories...

if not exist "%TARGET_PATH%\.opencode" (
    mkdir "%TARGET_PATH%\.opencode"
)

if not exist "%TARGET_PATH%\.opencode\memory" (
    mkdir "%TARGET_PATH%\.opencode\memory"
)

if not exist "%TARGET_PATH%\.opencode\plugins" (
    mkdir "%TARGET_PATH%\.opencode\plugins"
)

if not exist "%TARGET_PATH%\memory" (
    mkdir "%TARGET_PATH%\memory"
)

:: -------------------------------------------------------
:: Create functions.md
:: -------------------------------------------------------
if not exist "%TARGET_PATH%\memory\functions.md" (
    type nul > "%TARGET_PATH%\memory\functions.md"
)

:: -------------------------------------------------------
:: Copy AGENTS.md
:: -------------------------------------------------------
echo.
echo [3/5] Copying project files...

copy /Y "%SOURCE%\AGENTS.md" "%TARGET_PATH%\AGENTS.md" >nul

:: -------------------------------------------------------
:: Copy opencode.json
:: -------------------------------------------------------
if not exist "%TARGET_PATH%\opencode.json" (
    copy /Y "%SOURCE%\opencode.json" "%TARGET_PATH%\opencode.json" >nul
) else (
    echo [SKIP] opencode.json already exists
)

:: -------------------------------------------------------
:: Ensure .gitignore exists
:: -------------------------------------------------------
if not exist "%TARGET_PATH%\.gitignore" (

(
echo node_modules/
echo .next/
echo dist/
echo build/
echo .env
echo .env.local
echo .env*.local
echo tsconfig.tsbuildinfo
echo *.zip
) > "%TARGET_PATH%\.gitignore"

echo [INFO] Created .gitignore

) else (

findstr /C:"tsconfig.tsbuildinfo" "%TARGET_PATH%\.gitignore" >nul
if errorlevel 1 (
    echo tsconfig.tsbuildinfo>>"%TARGET_PATH%\.gitignore"
    echo [INFO] Added tsconfig.tsbuildinfo to .gitignore
)

)

:: -------------------------------------------------------
:: Copy plugin tools
:: -------------------------------------------------------
set "TOOL_DIR=%USERPROFILE%\.config\opencode\skills\tools"

if exist "%TOOL_DIR%" (

    for %%F in (
        smart_read.ts
        semantic_chunk.ts
        semantic_diff.ts
    ) do (

        if exist "%TOOL_DIR%\%%F" (

            if not exist "%TARGET_PATH%\.opencode\plugins\%%F" (

                copy /Y "%TOOL_DIR%\%%F" "%TARGET_PATH%\.opencode\plugins\%%F" >nul
                echo [INFO] Copied %%F

            ) else (

                echo [SKIP] %%F already exists

            )

        ) else (

            echo [SKIP] %%F not found

        )

    )

) else (

    echo [SKIP] Tool directory not found:
    echo        %TOOL_DIR%

)

:: -------------------------------------------------------
:: Copy pySlick
:: -------------------------------------------------------
if exist "%SOURCE%\pySlick" (

    if not exist "%TARGET_PATH%\pySlick" (

        xcopy "%SOURCE%\pySlick" "%TARGET_PATH%\pySlick\" /E /I /Y >nul
        echo [INFO] Copied pySlick

    ) else (

        echo [SKIP] pySlick already exists

    )

) else (

    echo [SKIP] pySlick folder not found in source

)

:: -------------------------------------------------------
:: Install dependencies
:: -------------------------------------------------------
echo.
echo [4/5] Installing dependencies...

if exist "%TARGET_PATH%\package.json" (

    where pnpm >nul 2>&1

    if errorlevel 1 (

        echo.
        echo [WARN] pnpm not found.
        echo.
        echo Run these manually:
        echo.
        echo    cd /d "%TARGET_PATH%"
        echo    pnpm add @opencode-ai/plugin web-tree-sitter @tree-sitter-grammars/tree-sitter-typescript @tree-sitter-grammars/tree-sitter-python
        echo    pnpm approve-builds
        echo.

    ) else (

        pushd "%TARGET_PATH%"

        echo.
        echo Installing packages...

        call pnpm add ^
            @opencode-ai/plugin ^
            web-tree-sitter ^
            @tree-sitter-grammars/tree-sitter-typescript ^
            @tree-sitter-grammars/tree-sitter-python

        if errorlevel 1 (
            echo.
            echo [WARN] Package installation reported errors.
        )

        echo.
        echo Approving native builds...

        call pnpm approve-builds

        if errorlevel 1 (
            echo.
            echo [WARN] pnpm approve-builds failed.
            echo.
            echo If using a newer pnpm version run:
            echo.
            echo    pnpm install --allow-build
            echo.
        )

        popd

    )

) else (

    echo [SKIP] package.json not found

)

:: -------------------------------------------------------
:: Finished
:: -------------------------------------------------------
echo.
echo ===================================================
echo             SECOND-BRAIN SETUP COMPLETE
echo ===================================================
echo.
echo Target:
echo   %TARGET_PATH%
echo.
echo Installed / Verified:
echo.
echo   AGENTS.md
echo   opencode.json
echo   .gitignore
echo   memory\functions.md
echo   .opencode\memory\
echo   .opencode\plugins\
echo   pySlick\
echo.
echo Plugin packages:
echo.
echo   @opencode-ai/plugin
echo   web-tree-sitter
echo   tree-sitter-typescript
echo   tree-sitter-python
echo.
echo Native builds:
echo.
echo   pnpm approve-builds
echo.
echo ===================================================

pause