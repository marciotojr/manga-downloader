const cheerio = require('cheerio')
const getUrls = require('get-urls')
const fetch = require ('node-fetch')
const { MongoClient } = require("mongodb")
circularJSON = require('circular-json')

const uri = "mongodb://localhost:27017"

const scrapeURL = async (_id, domain) => {

    const client = new MongoClient(uri)
    const database = client.db('webcrawler')
    const links_col = database.collection('links')
    const pages_col = database.collection('pages')


    let findResult = await links_col.findOne({
        _id: _id
    })
    await links_col.updateOne({_id: _id },{$set:{visited:true}})

    const urls = Array.from(getUrls(circularJSON.parse(findResult.url)))

    const requests = urls.map(async url => {

        const res = await fetch(url)
        const html = await res.text()
        const $ = cheerio.load(html)

        const links = $('a').map((index,el)=>(el.attribs.href))

        const page = {
            url: url,
            title: $('title').text(),
            text: circularJSON.stringify($('body').text()),
            links: circularJSON.stringify(links)
        }

        // Query for a movie that has the title 'Back to the Future'
        const query = { url: url }
        const page_db = await pages_col.findOne(query)

        if(!page_db){
            await pages_col.insertOne(page)
        }

        for(let el in links){
            try{
                const link = circularJSON.stringify(links[el])
                if(!link.includes(domain))continue;
                const query = { url: link }
                const link_db = await links_col.findOne(query)
                
                if(!link_db){
                    try {
                        url = new URL(links[el]);
                    } catch (_) {
                        continue;  
                    }
                    await links_col.insertOne({url:link, visited: false})
                }
            }catch{
                console.log(el, links[el])
            }
        }

    })

    return Promise.all(requests)
}

const scrapeDomain = async (domain, start) => {
    const client = new MongoClient(uri)

    const database = client.db('webcrawler')

    const link = circularJSON.stringify(start)
    const links_col = database.collection('links')
    await links_col.insertOne({url:link, visited: false})

    let findResult = null

    do{
        try{
            findResult = await links_col.findOne({
                visited: false
            })
            if(findResult){
                await scrapeURL(findResult._id,domain)
            }
        }finally{
            console.log('Um erro ocorreu. Talvez seja necessário reiniciar o script')
        }
    }while(findResult)
    


}



scrapeDomain('ufjf.br/deptocomputacao/', 'https://www.ufjf.br/deptocomputacao/')
