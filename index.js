const express = require('express')
require('dotenv').config()
var morgan = require('morgan')
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser')
const stripe = require("stripe")(process.env.GATEWAY_KEY);
const SSLCommerzPayment = require('sslcommerz-lts')
const store_id = 'bistr67951d2a185e3'
const store_passwd = 'bistr67951d2a185e3@ssl'
const is_live = false //true for live, false for sandbox

const app = express()
const formData = require('form-data');
const Mailgun = require('mailgun.js');
const mailgun = new Mailgun(formData);

const port = process.env.PORT || 5000
const mg = mailgun.client({username: 'api', key: process.env.MAILGUN_API_KEY || 'key-yourkeyhere'});
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174'],
  credentials: true,
  optionSuccessStatus: 200,
}))
app.use(express.json())
app.use(cookieParser())
app.use(morgan('dev'))
app.use(express.urlencoded())


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const { default: axios } = require('axios');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.9cbr8.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});
// Store ID: bistr67951d2a185e3
// Store Password (API/Secret Key): bistr67951d2a185e3@ssl


// Merchant Panel URL: https://sandbox.sslcommerz.com/manage/ (Credential as you inputted in the time of registration)


 
// Store name: testbistrlt85
// Registered URL: www.bistrodb.com
// Session API to generate transaction: https://sandbox.sslcommerz.com/gwprocess/v3/api.php
// Validation API: https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php?wsdl
// Validation API (Web Service) name: https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php
 
// You may check our plugins available for multiple carts and libraries: https://github.com/sslcommerz

async function run() {
  try {
   
    await client.connect();
    const menuCollection = client.db('bistroDB').collection('menu')
    const reviewCollection = client.db('bistroDB').collection('review')
    const cartCollection = client.db('bistroDB').collection('carts')
    const usersCollection = client.db('bistroDB').collection('users')
    const paymentsCollection = client.db('bistroDB').collection('payments')
   
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
    // payment gate way  payment releted api
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
    // after confirm payment then delete data from my cart and save payment data for payment history page 
    app.post('/payments', verifyToken , async(req, res) => {
      const payment = req.body
      const paymentResult = await paymentsCollection.insertOne(payment)
      // delete data from my cart after payment 
      const query = {
        _id: {
          $in: payment?.cartIds?.map(id => new ObjectId(id))
        }
      }
      const deleteResult = await cartCollection.deleteMany(query)
      // send confirmation email
      mg.messages.create(process.env.MAIL_SENDING_DOMAIN, {
        from: "Excited User <mailgun@sandbox302dd5fcdddc4d0e8205f5b24136e463.mailgun.org>",
        to: ["saidur.riaz1@gmail.com"],
        // to: [`${payment.email}`],
        subject: "Hello",
        text: "Bistro Boss Confirmation !",
        html: `<div>
        <h2>Thank you for your order</h2>
        <h4>Your Transaction Id: ${payment.transactionId}</h4>
        </div>`
      })
      .then(msg => console.log(msg)) // logs response data
      .catch(err => console.log(err)); // logs any
      res.send({paymentResult, deleteResult})

    })
    // after user pay money you have show his payment history route for payment history page by his email
    app.get('/payments/:email', verifyToken, async(req, res) => {
      const query = {email: req.params.email}
      if(req.params.email !== req.user?.email) return res.status(403).send({message: 'Forbidden Access'})
        const result = await paymentsCollection.find().toArray(query)
      res.send(result)
    })
    // route for ssl payment method
    app.post('/create-ssl-payment', async(req, res) => {
      let payment = req.body 
      const trxid = new ObjectId().toString()
       payment.transactionId = trxid
      // console.log(payment);
      const initiate = {
       store_id: store_id,
       store_passwd: store_passwd,
        total_amount: `${payment.price}`,
        currency: 'BDT',
        tran_id: trxid, // use unique tran_id for each api call
        success_url: 'http://localhost:5000/success-payment',
        fail_url: 'http://localhost:5173/fail',
        cancel_url: 'http://localhost:5173/cancel',
        ipn_url: 'http://localhost:5000/ipn-success-payment',
        shipping_method: 'Courier',
        product_name: 'Computer.',
        product_category: 'Electronic',
        product_profile: 'general',
        cus_name: 'Customer Name',
        cus_email: `${payment.email}`,
        cus_add1: 'Dhaka',
        cus_add2: 'Dhaka',
        cus_city: 'Dhaka',
        cus_state: 'Dhaka',
        cus_postcode: '1000',
        cus_country: 'Bangladesh',
        cus_phone: '01711111111',
        cus_fax: '01711111111',
        ship_name: 'Customer Name',
        ship_add1: 'Dhaka',
        ship_add2: 'Dhaka',
        ship_city: 'Dhaka',
        ship_state: 'Dhaka',
        ship_postcode: 1000,
        ship_country: 'Bangladesh',
    };
      const iniResponse = await axios({
        url: 'https://sandbox.sslcommerz.com/gwprocess/v4/api.php',
        method: 'POST',
        data: initiate,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      })
      // console.log(iniResponse);
      const gateWayUrl = iniResponse?.data?.GatewayPageURL
      // saved data to database status: pending after successful route hit then change it to done
      const savedData = await paymentsCollection.insertOne(payment)
      // console.log(gateWayUrl);
      res.send({gateWayUrl})
    })
    app.post('/success-payment', async(req, res) => {
      const paymentSuccess = req.body 
      // console.log('data', paymentSuccess);
      // send validation request to server 
      const {data} = await axios.get(`https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php?val_id=${paymentSuccess.val_id}&store_id=${store_id}&store_passwd=${store_passwd}&format=json`)
      if(data?.status !== 'VALID') return res.send({message: 'Invalid Payment'})
        // after validation update payment status 
      // console.log(data);
      const updatePayment = await paymentsCollection.updateOne({transactionId: data.tran_id}, {$set: {status: 'Success'}})
      // delete cart from users carts collection 
      // find specipic payment id
      const payment = await paymentsCollection.findOne({transactionId: data.tran_id})
        const query = {
          _id: {
            $in: payment?.cartIds?.map(id => new ObjectId(id))
          }
        }
        const deleteResult = await cartCollection.deleteMany(query)
      // console.log(updatePayment);
      // console.log('payment valid', isValidPayment);
      res.redirect('http://localhost:5000/success')
    })
    // stats and antics
    app.get('/admin-stats', verifyToken, verifyAdmin, async(req, res) => {
      const users = await usersCollection.estimatedDocumentCount()
      const orders = await paymentsCollection.estimatedDocumentCount()
      const menuItems = await menuCollection.estimatedDocumentCount()
      // get price from payment collection using aggrigate 
      const result = await paymentsCollection.aggregate([
     {
      $group: {
        _id: null,
        totalPrice: {$sum: '$price'},
      },
     },
      ]).toArray()
      const revenue = result.length > 0? result[0].totalPrice : 0;
      res.send({
        users,
        orders,
        menuItems,
        revenue
      })
    })
    // data user admin page ber chart here i use aggregate pipeline
  app.get('/order-stat', verifyToken, verifyAdmin,   async(req, res) => {
    const result = await paymentsCollection.aggregate([
      {
        $unwind : '$menuId',
      },
      {
        $addFields: {
          menuId: {$toObjectId: '$menuId'},
        },
      },
      {
        $lookup: {
          from: 'menu',
          localField: 'menuId',
          foreignField: '_id',
          as: 'menuItems',
        }
      },
      {
        $unwind: '$menuItems',
      },
      {
        $group: {
          _id: '$menuItems.category',
          quantity: {$sum: 1},
          revenue: {$sum: '$menuItems.price'}
        }
      },
      {
        $project: {
          _id: 0,
          category: '$_id',
          quantity: '$quantity',
          revenue: '$revenue',
        }
      }
    ]).toArray()
    res.send(result)
  })
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