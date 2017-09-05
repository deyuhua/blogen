all: clean server

d: deploy
s: server
u: upload
c: clean

deploy: # 生成HTML文件
	node blogen --type=deploy

server: # 开启本地实时预览服务器
	node blogen --type=server

upload: deploy # 部署到远程代码仓库
	git add . && \
	git commit -m 'deploy new version website' && \
	git push -f origin master && \
	echo "\n========== Notes: website deployed and synced !!! ==========\n"

clean: # 清除生成的HTML文件
	rm -rf public/pages/* index.html

setup: # 设置博客的目录和资源
	bash setup.sh
