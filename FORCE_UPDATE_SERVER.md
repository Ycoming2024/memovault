# 🔧 强制更新服务器代码指南

> **小白友好！** 强制更新服务器上的代码到最新版本。

---

## 📋 问题说明

**问题：** 服务器上的代码还是旧版本，即使执行了 `git pull`

**原因：** 可能有本地未提交的修改或 Git 冲突

**解决方案：** 强制使用远程代码（会丢失服务器上的本地修改）

---

## 🚀 操作步骤

### 1. SSH 连接到服务器

```bash
ssh root@your-server-ip
```

### 2. 进入项目目录

```bash
cd /var/www/memovault
```

### 3. 查看当前状态

```bash
git status
```

### 4. 强制更新到远程代码（推荐）

```bash
# 获取最新代码
git fetch origin

# 强制重置到远程主分支（会丢失服务器上的本地修改）
git reset --hard origin/main

# 查看状态
git status
```

### 5. 清理构建缓存

```bash
rm -rf .next
```

### 6. 重新构建

```bash
npm run build
```

### 7. 重启应用

```bash
pm2 restart all
```

---

## 📝 备选方案：保留服务器上的本地修改

如果你在服务器上有本地修改需要保留，可以：

```bash
# 1. 备份当前代码
git stash

# 2. 拉取最新代码
git pull origin main

# 3. 合并修改
git stash pop

# 4. 清理构建缓存
rm -rf .next

# 5. 重新构建
npm run build

# 6. 重启应用
pm2 restart all
```

---

## 🎉 完成！

构建应该可以成功完成了！

---

## 📚 相关文档

- 📖 查看 [`GIT_UPDATE_GUIDE.md`](GIT_UPDATE_GUIDE.md) 获取 Git 更新指南
- 📖 查看 [`OWN_SERVER_DEPLOYMENT.md`](OWN_SERVER_DEPLOYMENT.md) 获取自有服务器部署指南
- 📖 查看 [`DEPLOYMENT_GUIDE.md`](DEPLOYMENT_GUIDE.md) 获取其他平台部署指南

---

**祝你更新顺利！** 🚀
