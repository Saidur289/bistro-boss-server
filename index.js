const express = require('express')
require('dotenv').config()
var morgan = require('morgan')
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser')
const stripe = require("stripe")(process.env.GATEWAY_KEY);
const app = express()
const port = process.env.PORT || 5000
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174'],
  credentials: true,
  optionSuccessStatus: 200,
}))
app.use(express.json())
app.use(cookieParser())
app.use(morgan('dev'))


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.9cbr8.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
   
    await client.connect();
    const menuCollection = client.db('bistroDB').collection('menu')
    const reviewCollection = client.db('bistroDB').collection('review')
    const cartCollection = client.db('bistroDB').collection('carts')
    const usersCollection = client.db('bistroDB').collection('users')
    // generate token 
    app.post('/jwt', async(req, res) => {
      const email = req.body
      const token = jwt.sign(email, process.env.ACCESS_TOKEN_SECRET, {expiresIn: '365d'})
      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
      }).send({success: true})
    })
    // logout 
    app.get('/logout', async(req, res) => {
      try{
        res.clearCookie('token', {
          maxAge: 0,
          secure: process.env.NODE_ENV === 'production',
          sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
        }).send({success: true})
      }
      catch (err) {
        res.status(500).send(err)
      }
    })
    const verifyToken = async (req, res, next) => {
      const token = req.cookies?.token 
      if(!token) return res.status(401).send({ message: 'unauthorized access' })
        jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
      if(err){
        return res.status(401).send({ message: 'unauthorized access' })
      }
      req.user = decoded
      next()
      })
    }
    // verify admin verify
    const verifyAdmin = async(req, res, next) => {
      const email = req.user?.email 
      const query = {email: email}
      const user = await usersCollection.findOne(query)
      const isAdmin = user?.role === 'admin'
      if(!isAdmin){
        return res.status(403).send({message: 'Forbidden Access'})
    
      }
      next()
    }
    //  work - 1 get data from database 
    app.get('/menu', async(req, res) => {
        const result = await menuCollection.find().toArray()
        res.send(result)
        })
    // menu data post work - 2 
    app.post('/menu',verifyToken, verifyAdmin,  async(req, res) => {
      const item = req.body
      const result = await menuCollection.insertOne(item)
      res.send(result)
    }) 
     // menu data post work - 3 
     app.delete('/menu/:id', verifyToken, verifyAdmin,  async(req, res) => {
      const id = req.params.id 
      const query = {_id: new ObjectId(id)}
      const result = await menuCollection.deleteOne(query)
      console.log(result);
      res.send(result)
     }) 
     
     // menu data post work - 4 
     app.get('/menu/:id', async(req, res) => {
      const id = req.params.id 
      const query = {_id: new ObjectId(id)}
      const result = await menuCollection.findOne(query)
      res.send(result)
     })
     
     // menu data post work - 5 
     app.patch('/menu/:id', async(req, res) => {
      const id = req.params.id 
      const item = req.body
      const query = {_id: new ObjectId(id)}
      const updateDoc = {
        $set:{
          name: item.name,
          category: item.category,
          price: item.price,
          recipe: item.recipe,
          image: item.image
        }
      }
      const result = await menuCollection.updateOne(query, updateDoc)
      res.send(result)
     })
    // work -1 review collection     
    app.get('/reviews', async(req, res) => {
        const result = await reviewCollection.find().toArray()
        res.send(result)
    })
    // work -3 data coming from client side by post method
     app.post('/carts', async(req, res) => {
      const cart = req.body 
      const result = await cartCollection.insertOne(cart)
      res.send(result)
     })
    //  work-4 get cart data from database  by specific use
    app.get('/carts', verifyToken,  async(req, res) => {
      const email = req.query.email 
      const query = {email: email}
      const result = await cartCollection.find(query).toArray()
      res.send(result)
    })
    // work - 5 delete cart from my cart components
    app.delete('/carts/:id', async(req, res) => {
      const id = req.params.id 
      const query = {_id: new ObjectId(id)}
      const result = await cartCollection.deleteOne(query)
      res.send(result)
    })
    // work - 6 create post for save user data
    app.post('/users', async(req, res) => {
      const user = req.body
      const query = {email: user?.email}
      const isExists = await usersCollection.findOne(query)
      if(isExists) return res.send({message: 'You have already exists'})
        const result = await usersCollection.insertOne(user)
      res.send(result)
    })
    app.patch('/users/admin/:id', verifyToken, verifyAdmin,  async(req, res) => {
      // console.log('inside admin', req.cookies);
      const id = req.params.id 
      const query = {_id: new ObjectId(id)}
      const updateDoc = {
        $set: {
          role: 'admin'
        }
      }
      const result = await usersCollection.updateOne(query, updateDoc)
      res.send(result)
    })
    // work - 8 check admin 
    app.get('/user/admin/:email', verifyToken, async(req, res) => {
      const email = req.params.email 
      if(email !== req?.user?.email) {
        return res.status(401).send({message: 'Unauthorized Access'})
      }
      const query = {email: email}
      const user = await usersCollection.findOne(query)
      let admin = false
      if(user){
        admin = user?.role === 'admin'
      }
      res.send({admin})
    })
    // work - 6 get  user data
    app.get('/users', verifyToken, verifyAdmin,  async(req, res) => {
      const result = await usersCollection.find().toArray()
      console.log(req.cookies);
      res.send(result)
    })
    // work - 6 delete  user data
    app.delete('/users/:id', verifyToken, verifyAdmin,  async(req, res) => {
      console.log('inside admin', req.cookies);
      const id = req.params.id 
      const query = {_id: new ObjectId(id)}
      const result = await usersCollection.deleteOne(query)
      res.send(result)
    })
    // work - 7   user role  data
    app.patch('/users/admin/:id', verifyToken, verifyAdmin,  async(req, res) => {
      console.log('inside admin', req.cookies);
      const id = req.params.id 
      const query = {_id: new ObjectId(id)}
      const updateDoc = {
        $set: {
          role: 'admin'
        }
      }
      const result = await usersCollection.updateOne(query, updateDoc)
      res.send(result)
    })
    // work - 8 check admin 
    app.get('/user/admin/:email', verifyToken, async(req, res) => {
      const email = req.params.email 
      if(email !== req?.user?.email) {
        return res.status(401).send({message: 'Unauthorized Access'})
      }
      const query = {email: email}
      const user = await usersCollection.findOne(query)
      let admin = false
      if(user){
        admin = user?.role === 'admin'
      }
      res.send({admin})
    })
    // payment gate way 
    app.post("/create-payment-intent",verifyToken,  async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100)
    
      // Create a PaymentIntent with the order amount and currency
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        // In the latest version of the API, specifying the `automatic_payment_methods` parameter is optional because Stripe enables its functionality by default.
       payment_method_types: ['card'],
      });
    
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });
    
    
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('bistro boss menu and review coming...')
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})