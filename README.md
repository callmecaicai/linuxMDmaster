# Linux Md Master

一个本地 Markdown 浏览器，用来扫描目录中的 `.md` 文件，并通过浏览器进行查看。

## 功能

- 扫描一个或多个目录中的 Markdown 文件
- 以树形结构和文件列表展示内容
- 在浏览器中渲染 Markdown
- 提供静态资源与原始文件访问接口
- 支持刷新索引与基础缓存

## 项目结构

```text
Linux_Md_Master/
├─ mdbrowser/
│  ├─ __main__.py
│  ├─ server.py
│  ├─ routes.py
│  ├─ scanner.py
│  ├─ render.py
│  ├─ templates.py
│  ├─ config.py
│  ├─ cache.py
│  └─ ui/
├─ .gitignore
└─ README.md
```

## 运行要求

- Python 3.10+

## 启动方式

在项目根目录执行：

```bash
python -m mdbrowser
```

也可以指定一个要扫描的根目录：

```bash
python -m mdbrowser /path/to/your/docs
```

启动后程序会输出本地访问地址，并尝试自动打开浏览器。

## 默认行为

- 默认端口由 `mdbrowser/config.py` 中配置
- 未传入目录时，程序会使用项目上级目录作为默认根目录
- 仅允许访问已配置的允许目录范围内的文件

## 说明

这是一个本地使用的小型 HTTP Markdown 浏览工具，适合快速浏览文档目录。
