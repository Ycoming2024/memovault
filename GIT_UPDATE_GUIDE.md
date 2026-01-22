# 📝 Git 更新指南

> **小白友好！** 将修改后的文件推送到 GitHub。

---

## 📋 目录

1. [查看修改状态](#查看修改状态)
2. [添加修改的文件](#添加修改的文件)
3. [提交更改](#提交更改)
4. [推送到 GitHub](#推送到-github)

---

## 查看修改状态

### 在本地电脑上（Windows）

打开 PowerShell 或 CMD，进入项目目录：

```bash
cd c:/Users/admin/Desktop/bianqian
```

查看修改状态：

```bash
git status
```

你应该看到以下修改的文件：

```
modified:   src/app/api/health/route.ts
modified:   src/app/app/page.tsx
```

---

## 添加修改的文件

### 添加所有修改的文件

```bash
git add .
```

### 或者只添加特定文件

```bash
git add src/app/api/health/route.ts
git add src/app/app/page.tsx
```

---

## 提交更改

### 提交修改

```bash
git commit -m "fix: 修复构建错误

- 修复健康检查 API 端点中的 package.json 路径
- 移除未使用的 useNotes 导入
- 移除未使用的 notes 变量
- 移除未使用的 isLoading 变量
"
```

### 查看提交历史

```bash
git log --oneline
```

---

## 推送到 GitHub

### 推送到远程仓库

```bash
git push origin main
```

### 如果推送失败

如果提示需要拉取最新代码：

```bash
git pull origin main
git push origin main
```

### 如果需要强制推送（不推荐）

```bash
git push origin main --force
```

---

## 在服务器上拉取最新代码

### SSH 连接到服务器

```bash
ssh root@your-server-ip
```

### 进入项目目录

```bash
cd /var/www/memovault
```

### 拉取最新代码

```bash
git pull origin main
```

### 重新构建

```bash
npm run build
```

---

## 常见问题

### Q1: Git 提示 "nothing to commit"

**原因：** 所有修改已经提交

**解决方法：**
```bash
# 查看状态
git status

# 如果没有修改，可以创建新的提交
git commit --allow-empty -m "chore: empty commit"
```

### Q2: Git 提示 "Your branch is behind"

**原因：** 远程仓库有新的提交

**解决方法：**
```bash
# 拉取最新代码
git pull origin main

# 如果有冲突，解决冲突后提交
git add .
git commit -m "fix: resolve merge conflicts"
```

### Q3: Git 提示 "Permission denied"

**原因：** 没有权限推送到远程仓库

**解决方法：**
```bash
# 配置 Git 凭据
git config --global user.name "Your Name"
git config --global user.email "your-email@example.com"

# 或使用 SSH 密钥
ssh-keygen -t rsa -b 4096 -C "your-email@example.com"
# 将公钥添加到 GitHub
```

### Q4: 构建仍然失败

**原因：** 服务器上的代码没有更新

**解决方法：**
```bash
# 确保在服务器上拉取了最新代码
git pull origin main

# 查看本地修改
git status

# 清理构建缓存
rm -rf .next

# 重新构建
npm run build
```

---

## 完整的更新流程

### 在本地电脑上

```bash
# 1. 进入项目目录
cd c:/Users/admin/Desktop/bianqian

# 2. 查看修改状态
git status

# 3. 添加所有修改
git add .

# 4. 提交修改
git commit -m "fix: 修复构建错误

- 修复健康检查 API 端点中的 package.json 路径
- 移除未使用的 useNotes 导入
- 移除未使用的 notes 变量
- 移除未使用的 isLoading 变量
"

# 5. 推送到 GitHub
git push origin main
```

### 在服务器上

```bash
# 1. SSH 连接到服务器
ssh root@your-server-ip

# 2. 进入项目目录
cd /var/www/memovault

# 3. 拉取最新代码
git pull origin main

# 4. 清理构建缓存
rm -rf .next

# 5. 重新构建
npm run build

# 6. 重启应用
pm2 restart all
```

---

## 🎉 完成！

更新完成后，你的应用应该可以正常构建和运行了。

---

## 📚 相关文档

- 📖 查看 [`OWN_SERVER_DEPLOYMENT.md`](OWN_SERVER_DEPLOYMENT.md) 获取自有服务器部署指南
- 📖 查看 [`DEPLOYMENT_GUIDE.md`](DEPLOYMENT_GUIDE.md) 获取其他平台部署指南
- 📖 查看 [`QUICK_DEPLOY.md`](QUICK_DEPLOY.md) 获取快速部署指南

---

**祝你更新顺利！** 🚀
