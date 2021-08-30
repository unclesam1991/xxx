require('dotenv').config();
const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const axios = require('axios').default;
const express = require('express');
const app = express();
const qs = require('qs');

var bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: true }));


app.set('trust proxy', true)
app.set('x-powered-by', false);
let apiUrl = process.env.API;
console.log(apiUrl);
async function startBrowser(tmdb, info) {
    let ss = info.season;
    let ep = info.episode;
    info.tmdb = tmdb;
    let browser;
    try {
        console.log("Opening the browser......");
        browser = await puppeteer.launch({
            defaultViewport: null,
            headless: true,
            args: ["--disable-setuid-sandbox", "--start-maximized"],
            'ignoreHTTPSErrors': true
        });

        let page = await browser.newPage();
        await page.goto(`https://apimdb.net/e/tmdb/tv/${tmdb}/${ss}/${ep}`, {
            referer: 'https://apimdb.net/'
        });

        let bodyPage = await page.evaluate(() => document.body.innerHTML);

        let k = cheerio.load(bodyPage);
        let url = k('iframe').attr('src');
        console.log(url);
        await page.goto('https://apimdb.net' + url, {
            referer: 'https://apimdb.net/'
        });
        // Get the link server
        let contents = await page.$$eval('.server', content => {
            content = content.map(x => x.getAttribute("data-src"));
            return content;
        });
        let pagePromise = (link) => new Promise(async (resolve, reject) => {
            let newPage = await browser.newPage();
            await newPage.goto(link, { referer: 'https://apimdb.net/', waitUntil: 'load', timeout: 0 });
            let bodyHTML = await newPage.evaluate(() => document.body.innerHTML);
            let m = bodyHTML.match(/eval(.+?(?=\.split))/);
            if (m != undefined) {

                //let arr_param =  m[1] + ".split('|'),0,{}))";
                //let jwplayer = '';
                //let stringScript = (0, eval)(arr_param);
                // let k = await newPage.evaluate(arr_paramx =>{
                //     return arr_paramx;

                // },arr_param);
                // let n = '';
                // let reg = /{file:"([^"]+)/mg;
                // n = reg.exec(stringScript);
                // if(n[1].indexOf('http') !== 0) throw new Error('invalid');
                // let linkEmbed = n[1].replace(/{file:"/,'');
                resolve();
            } else {
                let $ = cheerio.load(bodyHTML);
                let url = $('iframe').attr('src');
                resolve(url);
            }
            await newPage.close();
        });
        let url_ar = [];
        for (content in contents) {
            //console.log(content);
            let url = 'https://apimdb.net' + contents[content];
            console.log(url);
            let links = await pagePromise(url);
            if (links != undefined) {
                url_ar.push(links);
            }

        }

        info.links = JSON.stringify(url_ar);
        info.source = 'tmdb';
        console.log(info);

        await browser.close();
        // let ps = qs.stringify(info);
        // let cmd = `curl ${apiUrl} -XPOST -d '${ps}' 2>/dev/null`;
        // let res = await runShell(cmd);
        // info.response = res;
        // console.log(res, cmd);
        // console.log(links);
        // await axios.post(apiUrl,info)
        //   .then(function (response) {
        //     console.log(response);
        //   })
        //   .catch(function (error) {
        //     console.log(error);
        //   });

        return info;
    } catch (err) {
        console.log("Could not create a browser instance => : ", err);
    }
}

const formHTML = (tmdb, title, year, ss, ep) => {
    return '<form method="post">'
        + `<input type="text" value="${tmdb}" name="tmdb" value="" placeholder="tmdb id or link tmdb"><br />`
        + `<input type="text" value="${title}"  name="title" value="" placeholder="title"><br />`
        + `<input type="text" value="${year}"  name="year" value="" placeholder="year"><br />`
        + `<input type="text" value="${ss}"  name="ss" value="" placeholder="season"><br />`
        + `<input type="text" value="${ep}"  name="ep" value="" placeholder="episode"><br />`
        + `<input type="submit" value="go"></form>`;
};

app.route('/tmdb')
    .all(async (req, res) => {
        let title = '';
        let year = 0;
        let ss = 0;
        let ep = 0;
        let tmdb = 0;
        if (Object.keys(req.body).length !== 0) {
            tmdb = req.body.tmdb;
            ss = req.body.ss ? req.body.ss : 0;
            ep = req.body.ep ? req.body.ep : 0;
            year = req.body.year ? req.body.year : 2020;
            title = req.body.title;
        } else {
            let f = req.query;
            title = f.title ? f.title : 0;
            year = f.year ? f.year : 0;
            ss = f.season ? f.season : 0;
            ep = f.episode ? f.episode : 0;
            tmdb = f.tmdb ? f.tmdb : 0;
        }

        if (!title) {
            let f = req.query;
            f.tmdb = f.tmdb ? f.tmdb : '';
            f.title = f.title ? f.title : '';
            f.year = f.year ? f.year : '';
            f.season = f.season ? f.season : '';
            f.episode = f.episode ? f.episode : '';
            res.send('no title<br />' + formHTML(f.tmdb, f.title, f.year, f.season, f.episode));
        } else {

            let links = await startBrowser(tmdb, {
                title: title,
                year: year,
                season: ss,
                episode: ep,
            });

            let f = req.query;
            f.tmdb = f.tmdb ? f.tmdb : '';
            f.title = f.title ? f.title : '';
            f.year = f.year ? f.year : '';
            f.season = f.season ? f.season : '';
            f.episode = f.episode ? f.episode : '';
            res.send(JSON.stringify(links) + '<br />' + formHTML(tmdb, title, year, ss, ep));
        }
    })

    app.listen(process.env.PORT || 3000)

