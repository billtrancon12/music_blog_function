const express = require("express");
const cors = require("cors");
const app = express();
const {MongoClient, GridFSBucket} = require('mongodb');
const mongoose = require('mongoose')
const {updateData, retrieveData} = require('./database_tools');
const multer = require('multer')
const router = express.Router()
const {GridFsStorage} = require('multer-gridfs-storage');
const Grid = require('gridfs-stream');
const fs = require('fs')
const path = require('path');
const crypto = require('crypto');
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

// Create storage engine
const storage = new GridFsStorage({
    url: `mongodb+srv://${process.env.db_username}:${process.env.db_password}@cluster0.liou3p7.mongodb.net/MusicBlogProject`,
    file: (req, file) => {
      return new Promise((resolve, reject) => {
        try{
            crypto.randomBytes(16, (err, buf) => {
            if (err) {
                return reject(err);
            }
            headerImageName = buf.toString('hex') + path.extname(file.originalname);
            const fileInfo = {
                filename: headerImageName,
                bucketName: 'uploads'
            };
            resolve(fileInfo);
            });
        }
        catch(err){
            console.log(err)
        }
      });
    }
  });
const upload = multer({ storage });

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



async function getBlogTopic(topic){
    const uri = `mongodb+srv://${process.env.db_username}:${process.env.db_password}@cluster0.liou3p7.mongodb.net/?retryWrites=true&w=majority`
    const client = new MongoClient(uri);   // Create a client end-point
    
    try{
        await client.connect();
        const result = await retrieveData(client, "MusicBlogProject", "BlogContent", {topic: topic}); // Put user into the database
        await client.close();
        return JSON.parse(JSON.stringify({status: true, body: result.body, message: "Success!"}));
    }
    catch(err){
        console.error(err);
        return undefined;
    }
}

// Put user into database function
async function putBlog(topic, headerImageName, date, content){
    const uri = `mongodb+srv://${process.env.db_username}:${process.env.db_password}@cluster0.liou3p7.mongodb.net/?retryWrites=true&w=majority`
    const client = new MongoClient(uri);   // Create a client end-point
    
    try{
        await client.connect();
        const result = await updateData(client, "MusicBlogProject", "BlogContent", {topic: topic},
        {$set: {
            topic: topic,
            image: headerImageName,
            date: date,
            content: content
        }}, {upsert: true}); // Put user into the database

        await client.close();
        return JSON.parse(JSON.stringify({status: true, body: result.body, message: "Success!"}));
    }
    catch(err){
        console.error(err);
        return undefined;
    }
}

async function putFile(path){
    const uri = `mongodb+srv://${process.env.db_username}:${process.env.db_password}@cluster0.liou3p7.mongodb.net/?retryWrites=true&w=majority`
    const client = new MongoClient(uri);   // Create a client end-point
    
    try{
        await client.connect();
        const db = client.db("MusicBlogProject")
        const bucket = new GridFSBucket(db, {bucketName: "myCustomBucket"})

        const readStream = fs.createReadStream(path).pipe(bucket.openUploadStream(path))
        await client.close();
        return JSON.parse(JSON.stringify({status: true, message: "Success!"}));
    }
    catch(err){
        console.error(err);
        return undefined;
    }
}

router.post('/check', async function(req, res){
    if(req.body.topic === ""){
        res.json(JSON.stringify({status: false, message: "Topic cannot be empty!"}))
        return
    }
    if(req.body.content === ""){
        res.json(JSON.stringify({status: false, message: "Content cannot be empty!"}))
        return;
    }
    result = await getBlogTopic(req.body.topic)
    if(result.body !== 'null'){
        res.json(JSON.stringify({status: false, message: "Topic already existed!"}))
        return;
    }
    
    res.json(JSON.stringify({status: true, message: "Success!"}))
})

router.post('/upload', upload.single('file_input'), async function(req, res){
    result = await putBlog(req.body.topic, headerImageName, req.body.date, req.body.content)

    if(result === undefined || result === null){
        res.json(JSON.stringify({status: false, message: "Something went wrong!"}))
        return
    }    
    res.json(JSON.stringify({status: true, message: "Success"}));
})

router.get('/files/', async function(req, res){
    const result = await gfs.files.findOne({ filename: req.query.filename })
    const readStream = gridfsBucket.openDownloadStream(result._id);
    readStream.pipe(res);
});

app.use(`/.netlify/functions/postBlog`, router);

module.exports = app;
module.exports.handler = serverless(app);
// app.listen(4000);
