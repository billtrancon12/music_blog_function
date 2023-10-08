const express = require("express");
const cors = require("cors");
const app = express();
const {MongoClient} = require('mongodb');
const mongoose = require('mongoose')
const {retrieveData, retrieveMultiData} = require('./database_tools');
const router = express.Router();
const Grid = require('gridfs-stream');
const methodOverride = require('method-override');
const bodyParser = require('body-parser');
require('dotenv').config();

let headerImageName;

const conn = mongoose.createConnection(`mongodb+srv://${process.env.db_username}:${process.env.db_password}@cluster0.liou3p7.mongodb.net/MusicBlogProject`)

let gfs, gridfsBucket;
conn.once('open', () => {
    // Init stream
    gfs = Grid(conn.db, mongoose.mongo);
    gfs.collection('uploads');
    gridfsBucket = new mongoose.mongo.GridFSBucket(conn.db, {
        bucketName: 'uploads'
    });
});

// Configuration
app.use(express.json({limit: '50mb'}));
app.use(cors());
app.use(function(req, res, next){
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET,HEAD,OPTIONS,POST,PUT,DELETE");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    next();
});
app.use(bodyParser.json());
app.use(methodOverride('_method'));
app.set('view engine', 'ejs');

async function getBlogBasedOnTopic(topic){
    const uri = `mongodb+srv://${process.env.db_username}:${process.env.db_password}@cluster0.liou3p7.mongodb.net/?retryWrites=true&w=majority`
    const client = new MongoClient(uri);   // Create a client end-point
    
    try{
        await client.connect();
        const result = await retrieveData(client, "MusicBlogProject", "BlogContent", {topic: topic}); 
        await client.close();
        return JSON.parse(JSON.stringify({status: true, body: result.body, message: "Success!"}));
    }
    catch(err){
        console.error(err);
        return undefined;
    }
}

async function getBlogs(){
    const uri = `mongodb+srv://${process.env.db_username}:${process.env.db_password}@cluster0.liou3p7.mongodb.net/?retryWrites=true&w=majority`
    const client = new MongoClient(uri);   // Create a client end-point
    
    try{
        await client.connect();
        const result = await retrieveMultiData(client, "MusicBlogProject", "BlogContent"); 
        await client.close();
        return JSON.parse(JSON.stringify({status: true, body: result.body, message: "Success!"}));
    }
    catch(err){
        console.error(err);
        return undefined;
    }
}

router.get('/blogs', async function(req, res){
    const result = await getBlogs()
    res.json(JSON.stringify({status: true, message: result}))
})

router.get('/blog', async function(req, res){
    const result = await getBlogBasedOnTopic(req.query.topic)
    res.json(JSON.stringify({status: true, message: result}))
})

router.get('/images/', async function(req, res){
    const result = await gfs.files.findOne({ filename: req.query.filename })
    const readStream = gridfsBucket.openDownloadStream(result._id);
    readStream.pipe(res);
});

app.use(`/.netlify/express/getBlog`, router);
module.exports = app;
module.exports.handler = serverless(app);

// app.listen(4001);
