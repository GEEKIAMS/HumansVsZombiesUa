// Generated by CoffeeScript 1.7.1
(function() {
  var MongoStore, UserFactory, app, async, authorize, bodyParser, bootable, config, cookieParser, express, expressWinston, favicon, http, log, moment, mongoose, passport, server, session, uuid, winston;

  process.env.APP_ENV === 'production' && require('newrelic');

  express = require('express');

  http = require('http');

  passport = require('passport');

  cookieParser = require('cookie-parser');

  bodyParser = require('body-parser');

  session = require('express-session');

  expressWinston = require('express-winston');

  log = require('winston-wrapper')(module);

  winston = require('winston');

  config = require('cnf');

  bootable = require('bootable');

  favicon = require('serve-favicon');

  mongoose = require('mongoose');

  authorize = require('./middleware/authorizeRole');

  moment = require('moment');

  uuid = require('node-uuid');

  async = require('async');

  MongoStore = require('connect-mongo')(session);

  UserFactory = require('./modules/userFactory');

  app = bootable(express());

  server = http.createServer(app);

  app.use(favicon(__dirname + '/client/img/favicon.png'));

  app.set('views', __dirname + '/views');

  app.set('view engine', 'jade');

  app.use(express["static"](__dirname + '/client'));

  app.use(cookieParser(config.cookieSecret));

  app.use(bodyParser());

  app.use(session({
    secret: config.sessionSecret,
    store: new MongoStore({
      url: config.mongoUrl
    }),
    maxAge: 3600 * 24 * 2
  }));

  app.use(passport.initialize());

  app.use(passport.session());

  app.phase(bootable.initializers('setup/initializers/'));

  app.all('/', function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "X-Requested-With");
    res.header("Cache-Control", "no-transform");
    return next();
  });

  app.get('/', authorize(), function(req, res) {
    var User;
    User = mongoose.model('user');
    return User.find(function(err, users) {
      res.viewData.section = 'home';
      res.viewData.users = users;
      return res.render('home', res.viewData);
    });
  });

  app.get('/admin', authorize('admin'), function(req, res, next) {
    var Medicine, User;
    User = mongoose.model('user');
    Medicine = mongoose.model('medicine');
    return User.find(function(err, users) {
      if (err) {
        return next(err);
      }
      users = users.reduce(function(list, user) {
        list.push(UserFactory(user.toObject()).getInfo());
        return list;
      }, []);
      res.viewData.users = users;
      return Medicine.find(function(err, medicines) {
        if (err) {
          return next(err);
        }
        res.viewData.medicines = medicines;
        res.viewData.section = 'admin';
        return res.render('admin', res.viewData);
      });
    });
  });

  app.post('/admin/generatemedcine', authorize('admin'), function(req, res, next) {
    var Medicine, count, createCode;
    count = parseInt(req.body.count) || 0;
    if (!((0 < count && count < 101))) {
      return next(new Error("Сірьожа, '" + count + "' не канає, не більше 100, не менше 1"));
    }
    Medicine = mongoose.model('medicine');
    createCode = function(cb) {
      var medicine;
      medicine = new Medicine({
        code: uuid.v4().substr(0, 13),
        generated: new Date(),
        description: req.body.description,
        unlimited: !!req.body.unlimited
      });
      return medicine.save(cb);
    };
    return async.times(count, function(n, next) {
      return createCode(next);
    }, function(err, codes) {
      if (err) {
        return next(err);
      }
      console.log("generated " + codes.length + " medicine codes");
      return res.redirect('/admin');
    });
  });

  app.post('/human/submitMedicine', authorize('human'), function(req, res, next) {
    var Medicine, User, code;
    code = req.body.code;
    Medicine = mongoose.model('medicine');
    User = mongoose.model('user');
    if (!code) {
      return next(new Error('Code should be provided'));
    }
    return Medicine.findOne({
      'code': code,
      'usedBy': {
        $exists: false
      }
    }, function(err, medicine) {
      if (err) {
        return next(err);
      }
      if (medicine) {
        if (!medicine.unlimited && moment().diff(moment(medicine.generated)) > 26 * 3600 * 1000) {
          res.viewData.profileMessage = "Извините, код просрочен";
          return res.render((req.cookies.mobile ? 'mobile' : 'profile'), res.viewData);
        }
        medicine.usedBy = req.user.vkontakteId;
        medicine.usedTime = new Date();
        return medicine.save(function(err) {
          if (err) {
            return next(err);
          }
          return User.findOneAndUpdate({
            'vkontakteId': req.user.vkontakteId
          }, {
            lastActionDate: new Date()
          }, function(err, user) {
            if (err) {
              return next(err);
            }
            res.viewData.user = UserFactory(user.toObject()).getInfo();
            res.viewData.profileMessage = "Код сработал!";
            return res.render((req.cookies.mobile ? 'mobile' : 'profile'), res.viewData);
          });
        });
      } else {
        res.viewData.profileMessage = "Извините, код уже использован или не существует.";
        return res.render((req.cookies.mobile ? 'mobile' : 'profile'), res.viewData);
      }
    });
  });

  app.post('/zombie/submitHuman', authorize('zombie'), function(req, res, next) {
    var User, hash;
    hash = req.body.hash;
    User = mongoose.model('user');
    if (!hash) {
      return next(new Error('Hash should be provided'));
    }
    return User.findOne({
      'hash': hash
    }, function(err, user) {
      var userObj;
      if (err) {
        return next(err);
      }
      if (user) {
        userObj = user.toObject();
        UserFactory(userObj).getInfo();
        if (userObj.role !== 'human' || userObj.isDead) {
          res.viewData.profileMessage = "Нельзя съесть зомби или труп";
          return res.render((req.cookies.mobile ? 'mobile' : 'profile'), res.viewData);
        }
        user.getZombie = new Date();
        user.lastActionDate = new Date();
        return user.save(function(err) {
          if (err) {
            return next(err);
          }
          return User.findOne({
            'vkontakteId': req.user.vkontakteId
          }, function(err, thisUser) {
            if (err) {
              return next(err);
            }
            thisUser.lastActionDate = new Date();
            if (!thisUser.getZombie) {
              thisUser.getZombie = new Date();
            }
            return thisUser.save(function(err, user) {
              if (err) {
                return next(err);
              }
              res.viewData.user = UserFactory(user.toObject()).getInfo();
              res.viewData.profileMessage = "Код сработал";
              return res.render((req.cookies.mobile ? 'mobile' : 'profile'), res.viewData);
            });
          });
        });
      } else {
        res.viewData.profileMessage = "Извините, человек не найден";
        return res.render((req.cookies.mobile ? 'mobile' : 'profile'), res.viewData);
      }
    });
  });

  app.get('/auth/vkontakte', passport.authenticate('vkontakte', {
    scope: ['friends']
  }), function(req, res) {
    return res.redirect('/');
  });

  app.get('/login/mobile', passport.authenticate('vkontakte', {
    scope: ['friends'],
    successRedirect: '/m',
    failureRedirect: '/m'
  }), function(req, res) {
    return res.redirect('/m');
  });

  app.get('/auth/vkontakte/callback', passport.authenticate('vkontakte', {
    failureRedirect: '/'
  }), function(req, res) {
    console.log('req.cookies.mobile', req.cookies.mobile);
    return res.redirect(req.cookies.mobile ? 'mobile' : '/');
  });

  app.get('/logout', function(req, res) {
    req.logout();
    return res.redirect(req.cookies.mobile ? '/m' : '/');
  });

  app.get('/teamHuman', authorize('human'), function(req, res) {
    var User;
    res.viewData.vkAppId = config.vk.appId;
    res.viewData.section = 'teamHuman';
    User = mongoose.model('user');
    return User.find(function(err, users) {
      var teamUsers, user, _i, _len;
      teamUsers = [];
      for (_i = 0, _len = users.length; _i < _len; _i++) {
        user = users[_i];
        user = UserFactory(user).getInfo();
        if (user.role === 'human') {
          teamUsers.push(user);
        }
      }
      res.viewData.users = teamUsers;
      return res.render('teamHuman', res.viewData);
    });
  });

  app.get('/teamZombie', authorize('zombie'), function(req, res) {
    var User;
    res.viewData.vkAppId = config.vk.appId;
    res.viewData.section = 'teamZombie';
    User = mongoose.model('user');
    return User.find(function(err, users) {
      var teamUsers, user, _i, _len;
      teamUsers = [];
      for (_i = 0, _len = users.length; _i < _len; _i++) {
        user = users[_i];
        user = UserFactory(user).getInfo();
        if (user.role === 'zombie') {
          teamUsers.push(user);
        }
      }
      res.viewData.users = teamUsers;
      return res.render('teamZombie', res.viewData);
    });
  });

  app.get('/profile', authorize('any'), function(req, res) {
    return res.render('profile', res.viewData);
  });

  app.get('/rules', authorize(), function(req, res) {
    res.viewData.section = 'rules';
    return res.render('rules', res.viewData);
  });

  app.get('/m', authorize(), function(req, res) {
    return res.render('mobile', res.viewData);
  });

  app.use(function(req, res) {
    return authorize()(req, res, function() {
      if (req.cookies.mobile) {
        return res.status(404).render('messageMobile', {
          message: '404, страница не найдена'
        });
      }
      return res.status(404).render('404', res.viewData);
    });
  });

  app.use(expressWinston.errorLogger({
    transports: [
      new winston.transports.Console({
        colorize: true
      })
    ]
  }));

  app.use(function(err, req, res, next) {
    return authorize()(req, res, function() {
      if (req.cookies.mobile) {
        return res.status(500).render('messageMobile', {
          message: 'Непредвиденная ошибка на сайте, сообщите об етой ошибке администратору сайта ' + err
        });
      }
      res.viewData.message = err;
      return res.status(500).render('500', res.viewData);
    });
  });

  app.boot(function(err) {
    var port;
    if (err) {
      console.error(err);
    }
    port = config.http.port;
    server.listen(port);
    return console.info('server started at ' + config.http.siteUrl + ' '.green);
  });

}).call(this);

//# sourceMappingURL=app.map
