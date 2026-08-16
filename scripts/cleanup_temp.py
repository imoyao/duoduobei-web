# -*- coding: utf-8 -*-
"""通用临时文件清理脚本（安全删除入口）——duoduobei-web 版。

移植自 fundmate 仓库 backend/scripts/cleanup_temp.py，沿用其安全契约：
- 默认 DRY_RUN：仅打印「将要删除的文件」，绝不真正删除；
- 必须显式传 --apply 才真正删除；
- 删除前二次核验 git 跟踪状态（git ls-files --error-unmatch）：已跟踪文件一律
  跳过（标 [TRACKED-将跳过]），只删未跟踪 / 被 .gitignore 忽略的临时产物，
  防止误删业务代码 / 配置 / 入库资产。

用法：
    python scripts/cleanup_temp.py --file _msg.txt --file _nav_desktop.png   # 仅打印清单
    python scripts/cleanup_temp.py --file _msg.txt --file _nav_desktop.png --apply   # 确认后删
    python scripts/cleanup_temp.py            # 默认模式（按 DEFAULT_PATTERNS）仅打印
"""

import argparse
import fnmatch
import os
import subprocess
import sys

# 仓库根目录推断：scripts/cleanup_temp.py -> 上一级即仓库根。
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(SCRIPT_DIR)

# 默认只允许在仓库根内清理，不递归扫源码，防止误伤业务代码。
DEFAULT_DIRS = [REPO_ROOT]

# 默认文件名匹配模式（fnmatch 风格）。
DEFAULT_PATTERNS = ['.tmp_*', '_commit_*', '_commit_msg_*', '_cleanup_*', '_nav_*', '_msg*']


def collect(dirs, patterns):
    found = []
    for base in dirs:
        if not os.path.isdir(base):
            continue
        for name in os.listdir(base):
            full = os.path.join(base, name)
            if not os.path.isfile(full):
                continue
            if any(fnmatch.fnmatch(name, pat) for pat in patterns):
                found.append(full)
    return sorted(found)


def is_untracked(path):
    """判断文件是否「未被 git 跟踪」——只有未跟踪（含被 .gitignore 忽略）才允许删。

    用 `git ls-files --error-unmatch <path>`：退出码 0 = 已在索引（已跟踪）→ 不删；
    非 0 = 未跟踪/被忽略 → 可删。git 不可用则保守返回 False（不删）。
    """
    if not os.path.exists(path):
        return False
    try:
        r = subprocess.run(
            ['git', 'ls-files', '--error-unmatch', path],
            cwd=REPO_ROOT,
            capture_output=True,
            text=True,
            encoding='utf-8',
        )
    except Exception:
        return False
    return r.returncode != 0


def main(argv=None):
    ap = argparse.ArgumentParser(description='通用临时文件清理（默认 dry-run，删除前核验 git 未跟踪）')
    ap.add_argument('--dir', action='append', default=None, help='额外允许清理的目录（可多次）；默认仅仓库根')
    ap.add_argument('--pattern', action='append', default=None, help='额外匹配的文件名模式（可多次）')
    ap.add_argument(
        '--file',
        action='append',
        default=None,
        help='精确文件路径（可多次）；最安全，优先用此方式逐项列出要删文件',
    )
    ap.add_argument('--apply', action='store_true', help='真正删除（默认仅打印清单）')
    args = ap.parse_args(argv)

    files = []
    if args.file:
        for f in args.file:
            f = os.path.abspath(f)
            if os.path.isfile(f):
                files.append(f)
            else:
                print(f'[warn] 文件不存在，跳过：{f}', file=sys.stderr)
    else:
        dirs = args.dir if args.dir else DEFAULT_DIRS
        patterns = args.pattern if args.pattern else DEFAULT_PATTERNS
        files = collect(dirs, patterns)

    if not files:
        print('[cleanup] 没有可清理的临时文件。')
        return

    annotated = []
    for f in sorted(files):
        tracked = not is_untracked(f)
        tag = '[TRACKED-将跳过]' if tracked else '[untracked]'
        annotated.append((f, tracked, tag))

    print(f'[cleanup] 匹配到 {len(annotated)} 个文件：')
    for f, tracked, tag in annotated:
        print(f'  {tag} {f}')

    removable = [f for f, tracked, _ in annotated if not tracked]
    if not removable:
        print('\n[cleanup] 没有未跟踪文件可删（全部已跟踪，已自动跳过，未删除任何文件）。')
        return

    if not args.apply:
        print('\n[cleanup] DRY-RUN 模式：未删除任何文件。确认以上 [untracked] 清单无误后加 --apply 执行。')
        return

    removed = 0
    for f in removable:
        try:
            os.remove(f)
            removed += 1
            print(f'[removed] {f}')
        except OSError as e:
            print(f'[error] 删除失败 {f}: {e}', file=sys.stderr)
    print(f'\n[cleanup] 已删除 {removed}/{len(removable)} 个未跟踪文件（已跟踪文件已跳过）。')


if __name__ == '__main__':
    main()
