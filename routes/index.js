'use strict';
var express = require('express');
var multer = require('multer');
var upload = multer({ dest: 'uploads/' })
var router = express.Router();
const bodyParser = require('body-parser');
const jsonParser = bodyParser.json();
const config = require('../config');
// var csv = require('fast-csv');
var fs = require('fs'); 
var csv = require('csv-parser');

var {Transaction} = require('../models/transactions');

const {User} = require('../models/user');
var passport = require('passport');
var Strategy = require('passport-local').Strategy;

//define the local strategy
passport.use(new Strategy(
    function(username, password, done) {
        User.findOne({ username: username }, function (err, user) {

            if (err) { return done(err); }
            if (!user) { return done(null, false); }
            // return done(null, user);
            user.validatePassword(password)
                .then(function (value) {
                    console.log(value);
                    if (value) {
                        return done(null, user)
                    } else {
                        return done(null, false);
                    }
                })
        });
    }
));

passport.serializeUser(function(user, done) {
    done(null, user.id);
});

passport.deserializeUser(function(id, done) {
    User.findById(id, function (err, user) {
        done(err, user);
    });
});

/* GET home page. */
router.get('/', function(req, res, next) { //gives the homepage
  // res.send('respond with a resource');
  res.render('landing', { title: 'Express' });
});

// GET budget dashboard page
router.get('/dashboard', function(req, res, next) {
	    if(!req.user){
        res.redirect('/')
    } else {
      res.render('dashboard', {
        categories: req.user.categories
      }); //end of dashboard

  } // end of else
}); //end of GET DASHBOARD

// GET transactions page
router.get('/transactions', function(req, res, next) {
    // console.log(req.user.transactions);
    if(!req.user){
      res.redirect('/')
    } else {
       res.render('transactions', {
        transactions: req.user.transactions,
        categories: req.user.categories
       });
  }
});

// GET upload page
router.get('/upload', function(req, res, next) {
	    if(!req.user){
        res.redirect('/')
    } else {
        res.render('upload');
  }
});

router.get('/faq', function(req, res, next) {

     //  if(!req.user){
    //     res.redirect('/')
    // } else {
         res.render('faq');
  // }
});

// GET new user creation page

router.get('/new-user', function(req, res, next) {
  res.render('new-user', { title: 'Express' });
});



// POST: LOGIN
router.post('/', passport.authenticate('local', { 
	failureRedirect: '/' }), 
function(req, res) {

  res.redirect('/dashboard');
});

var type = upload.single('csvFile');

// POST: UPLOAD TRANSACTIONS FILE
let requser;
router.post('/upload', type, function(req, res) {
  let transactionResultsArray = []
  requser = req.user;
  User.findById(req.user._id, function (err, user) {
        // console.log(user)
    });
  // console.log('the following is req.file from line 106:')
  // console.log(req.user);
  // console.log(req.file);
  // console.log('this is user, line 137 in index');
  // console.log(user);

  if (!req.file) {
    // if there's no file, just quit now
    return res.status(400).send('No files were uploaded.');
   }
  fs.createReadStream(req.file.path)
  .pipe(csv())
  .on('data', function (data) { //
    let results = {};
    results.transdate = data['Post Date'];
    results.description = data['Description'];
    results.debit = data['Debit'];
    results.credit = data['Credit'];
    results.balance = data['Balance_anon'];
    results.category = data['category'];
    User.find({transactions: { //NOTE: querying subdocs like this requires an *exact* match, including order
      transdate: results.transdate,
      description: results.description,
      debit: results.debit,
      credit: results.credit,
      balance: results.balance,
      category: results.category,
    }})
    .count() //check if .count() works
    .then(count => {
      if (count > 0) {
        // That transaction was already in the db
        return Promise.reject({
          code: 422,
          reason: 'ValidationError',
          message: 'transaction already in db',
          location: 'transaction'
        });
      }
      // If that transaction isn't in the db, then:
      return results
    })
    .then( results => {
      console.log('that transaction was new, so we will add it');

      // req.user.transactions.push(transactionResultsArray);
      transactionResultsArray.push(results)
      // console.log(req.user);
      return transactionResultsArray
    }) //closes the results -> push
    // .then(  results => {
    //   req.user.save(function (err) {

    //     if (err) console.log(err)
    //   });
    // })
  }) // closes the on data
  .on('end', function () {
    console.log('this is the results array');
    console.log(transactionResultsArray);
    req.user.transactions.push(transactionResultsArray);
     req.user.save(function (err) {
      // console.log(req.user);
      if (err) console.log(err)
    });
    console.log('at the end');
    res.redirect('transactions');
  })
}); // end of post


// POST: CREATE NEW USER
router.post('/new-user', jsonParser, (req, res) => {

  const requiredFields = ['username', 'password'];
  const missingField = requiredFields.find(field => !(field in req.body));
  console.log('we are in the create new user post');
  console.log(req.body);

  if (missingField) {
    return res.status(422).json({
      code: 422,
      reason: 'ValidationError',
      message: 'Missing field',
      location: missingField
    });
  }
  const stringFields = ['username', 'password', 'firstName', 'lastName'];
  const nonStringField = stringFields.find(
    field => field in req.body && typeof req.body[field] !== 'string'
  );
  if (nonStringField) {
    return res.status(422).json({
      code: 422,
      reason: 'ValidationError',
      message: 'Incorrect field type: expected string',
      location: nonStringField
    });
  }

  const explicityTrimmedFields = ['username', 'password'];
  const nonTrimmedField = explicityTrimmedFields.find(
    field => req.body[field].trim() !== req.body[field]
  );

  if (nonTrimmedField) {
    return res.status(422).json({
      code: 422,
      reason: 'ValidationError',
      message: 'Cannot start or end with whitespace',
      location: nonTrimmedField
    });
  }

  const sizedFields = {
    username: {
      min: 1
    },
    password: {
      min: 10,
      // bcrypt truncates after 72 characters, so let's not give the illusion
      // of security by storing extra (unused) info
      max: 72
    }
  };
  const tooSmallField = Object.keys(sizedFields).find(
    field =>
      'min' in sizedFields[field] &&
            req.body[field].trim().length < sizedFields[field].min
  );
  const tooLargeField = Object.keys(sizedFields).find(
    field =>
      'max' in sizedFields[field] &&
            req.body[field].trim().length > sizedFields[field].max
  );

  if (tooSmallField || tooLargeField) {
    return res.status(422).json({
      code: 422,
      reason: 'ValidationError',
      message: tooSmallField
        ? `Must be at least ${sizedFields[tooSmallField]
          .min} characters long`
        : `Must be at most ${sizedFields[tooLargeField]
          .max} characters long`,
      location: tooSmallField || tooLargeField
    });
  }

  let {username, password, firstName = '', lastName = ''} = req.body;
  // Username and password come in pre-trimmed, otherwise we throw an error
  // before this
  firstName = firstName.trim();
  lastName = lastName.trim();

  return User.find({username})
    .count()
    .then(count => {
      if (count > 0) {
        // There is an existing user with the same username
        return Promise.reject({
          code: 422,
          reason: 'ValidationError',
          message: 'Username already taken',
          location: 'username'
        });
      }
      // If there is no existing user, hash the password
      return User.hashPassword(password);
    })
    .then(hash => {
    	console.log('there was no existing user with that username, so we will create it');
      return User.create({
        username,
        password: hash,
        firstName,
        lastName
      });
    })
    .then (function(user) {
      //intialize with categories: 
      var initialCategoryList = ['housing', 'groceries', 'transportation', 'clothes', 'giving', 'books']

      initialCategoryList.forEach(function(category) {
        var category = {categoryName: category,
                      budgeted: 0,
                      activity: 0,
                      available: 0}
        console.log(category);
        user.categories.push(category);
        
        }); 
        user.save(function (err) {
          if (err) console.log(err);
          //console.log('Success!');
          })
          // end of 'then' for initializing categories
      // for(var i = 0; i < initialCategoryList.length; i++) {
      //   console.log('this is i in category array');
      //   console.log(i);
      //   var category = {categoryName: initialCategoryList.length[i],
      //                 budget: 0,
      //                 activity: 0,
      //                 available: 0}
      //   user.categories.push(category);
      //   user.save(function (err) {
      //     if (err) console.log(err);
      //     //console.log('Success!');
      //   })
      // } // end of for var

       
      return
    }) // end of then
    .then( function() {
    	console.log('successful creation of user');
    	res.redirect('/');
    
      // return res.status(201).json(user.serialize());
    })
    .catch(err => {
      // Forward validation errors on to the client, otherwise give a 500
      // error because something unexpected has happened
      if (err.reason === 'ValidationError') {
        return res.status(err.code).json(err);
      }
      res.status(500).json({code: 500, message: 'Internal server error'});
    });
});



module.exports = router;
