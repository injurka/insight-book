---
name: git-workflow
description: Git-жизненный цикл ветки — коммиты, сводка изменений для MR и релизные теги. Применяется как точка входа для git-операций в проекте.
has-sub-skill: true
---

# Git Workflow

Родительский скилл для git-операций проекта. Конкретные действия делегируются дочерним саб-скиллам:

- `git-workflow/git-commit` — коммит и push изменений (Conventional Commits).
- `git-workflow/changes-diff` — генерация `changes-diff.md` со сводкой diff ветки для Merge Request.
- `git-workflow/git-release-minor` — выпуск минорного релиза (новый тег + push).
- `git-workflow/git-release-patch` — выпуск патч-релиза (новый тег + push).
