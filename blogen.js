#!/usr/bin/env node

// Generate Markdown To Concise Style Blog With Just 200 Lines Code
const path = require('path');
const fs = require('fs');
const marked = require('marked');
const uniqueSlug = require('unique-slug');
const favicon = require('serve-favicon');


//  Bloggen Main Class
class Blogen{

    constructor(configPath, templatePath) {
        this.configPath = configPath;
        this.templatePath = templatePath;

        this.config = this.parseConfig(configPath);
        this.template = this.templateLoader(templatePath);

        this.port = 4000;
        this.markdown2html = {};

        this.plugins = {
            pluginInHead: "",
            pluginInBody: ""
        };
        this.readPlugins();
    }

    // simple file read and write warp func
    read(path) {
        try {
            return fs.readFileSync(path, "utf8").toString();
        } catch(ex) {
            console.error(ex.message);
            return "";
        }
    }

    readMarkdown(mdPath) {
        const readme = this.read(mdPath);
        const mdPattern = /\(.*\.md\)/g;

        return readme.replace(mdPattern, match => {
            const relateMdPath = match.slice(1, match.length-1);
            const realMdPath = path.join(__dirname, relateMdPath);

            if (this.markdown2html[realMdPath]) {
                return "(" + this.markdown2html[realMdPath] + ')';
            } else {
                return "(/404.html)";
            }
        });
    }

    readPlugins() {

        const plugins = this.plugins = {
            pluginInHead: "",
            pluginInBody: ""
        };
        const {pluginInHead, pluginInBody} = this.config.plugins;
        const pluginsDir = path.join(__dirname, this.config.pluginsDir);

        const helper = plugin => {
            const realPath = path.join(pluginsDir, plugin + '.plugin');

            if (!fs.existsSync(realPath)) {
                this.write(realPath, "");
            }

            return this.read(realPath);
        };

        if (!(fs.existsSync(pluginsDir) && fs.statSync(pluginsDir).isDirectory())) {
            fs.mkdirSync(pluginsDir);
        }

        plugins.pluginInHead += pluginInHead.map(helper).join("\n");
        plugins.pluginInBody += pluginInBody.map(helper).join("\n");
    }

    write(path, data, flag='w') {
        try {
            fs.writeFileSync(path, data, {flag});
        } catch(ex) {
            console.error(ex.message);
        }
    }

    // load yml config and template
    parseConfig(path) {
        return require('yamljs').parse(this.read(path));
    }

    templateLoader(path) {
        return this.read(path);
    }

    // watch file change
    watch(reloadServer) {
        const watch = require('node-watch');
        const {indexMd, privateDir} = this.config;
        const m2h = this.markdown2html;

        const reloadServerWrap = (message, status=" Synced!!!") => {
            const now = new Date();

            reloadServer.reload();
            console.log(now + "   =>   " + message + status);
        };

        // case 1: global config file change
        watch([this.configPath], (evt, name) => {
            console.log(this.configPath);
            this.config = this.parseConfig(this.configPath);
            console.log(this.config);
        });

        //case 2: template file change, re-regerate all markdown
        watch([this.templatePath], (evn, name) => {
            this.template = this.templateLoader(this.templatePath);

            for (const [src, dst] of Object.entries(this.markdown2html)) {
                if (fs.existsSync(dst))
                    fs.unlinkSync(dst);

                this.genHtml(src, dst);
            }

            reloadServerWrap("All Markdown Files");
        });

        // case 3: watch all markdowns
        const indexMdReal =  path.join(__dirname, indexMd);
        const privateDirReal = path.join(__dirname, privateDir);

        watch([indexMdReal, privateDirReal], {recursive: true}, (evt, mdName) => {

            const mdExist = fs.existsSync(mdName);

            if (mdName.indexOf('#') !== -1)
                return;

            if (!mdExist) {
                if (m2h[mdName]) {
                    fs.unlinkSync(m2h[mdName]);
                    delete m2h[mdName];
                }

                reloadServerWrap(path.basename(mdName), " Deleted !!!");
                return;
            }

            const status = fs.statSync(mdName);
            const endWithMd = status.isFile() && path.extname(mdName) === '.md';

            if (!endWithMd)
                return;

            if (m2h[mdName])
                this.genHtml(mdName, m2h[mdName]);
            else
                this._deployHelper(m2h, mdName);

            reloadServerWrap(path.basename(mdName, ".md"));
        });
    }

    // generate all markdown to html file 
    genHtml(src, dst) {
        // emacs temporary files
        if (src.indexOf('#') !== -1)
            return;

        const template = this.template;

        const {pluginInHead, pluginInBody} = this.plugins;
        const {keywords, description, title, url} = this.config;

        const id = path.basename(dst, '.html');
        const markedString = marked(this.readMarkdown(src));

        this.write(dst, eval("`" + template + "`"));
    }

    _deployHelper(m2h, mdName) {
        const htmlName = uniqueSlug(mdName) + '.html';

        m2h[mdName] = path.join(this.config.pagesDir, htmlName);
        this.genHtml(mdName, m2h[mdName]);
    }

    deploy() {
        const glob = require('glob');
        const m2h = this.markdown2html;

        const private_ = path.join(__dirname, this.config.privateDir);

        glob("**/*.md", {cwd: private_}, (err, mds) => {
            if (err) return;

            // all blog markdown
            mds.forEach(mdName => {
                mdName = path.join(private_, mdName);
                this._deployHelper(m2h, mdName);
            });

            // README.md => index.html
            const readme = path.join(__dirname, this.config.indexMd);
            m2h[readme] = path.join(__dirname, 'index.html');

            this.genHtml(readme, m2h[readme]);
        });
    }

    // setup express server
    server() {
        const reload = require('reload');
        const express = require('express');
        const app = express();

        // generate all markdowns to html
        this.deploy();

        app.use(express.static(__dirname));
        app.use(favicon(path.join(__dirname, 'favicon.ico')));

        app.listen(this.port, () => {
            console.log('\n======= Server listen on port ' + this.port + ' =======\n');

            const reloadServer = reload(app);
            this.watch(reloadServer);
        });
    }
}

function dispatch() {
    const args = require("args-parser")(process.argv);
    const { type } = args;

    const configPath = path.join(__dirname, '_config.yml');
    const templatePath = path.join(__dirname, 'pages.template');

    const blogen = new Blogen(configPath, templatePath);

    switch(type) {
    case 'server':
        blogen.server();
        break;
    case 'deploy':
        blogen.deploy();
        break;
    default:
        return; //pass
    }
}

dispatch();
