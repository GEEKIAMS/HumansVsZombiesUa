// Generated by CoffeeScript 1.7.1
(function() {
  var app, bodyParser, bootable, config, cookieParser, express, expressSession, expressWinston, favicon, http, log, passport, server, winston;

  express = require('express');

  http = require('http');

  passport = require('passport');

  cookieParser = require('cookie-parser');

  bodyParser = require('body-parser');

  expressSession = require('express-session');

  expressWinston = require('express-winston');

  log = require('winston-wrapper')(module);

  winston = require('winston');

  config = require('cnf');

  bootable = require('bootable');

  favicon = require('serve-favicon');

  app = bootable(express());

  server = http.createServer(app);

  app.use(favicon(__dirname + '/client/favicon.png'));

  app.set('views', __dirname + '/views');

  app.set('view engine', 'jade');

  app.use(express["static"](__dirname + '/client'));

  app.use(cookieParser(config.cookieSecret));

  app.use(bodyParser());

  app.use(expressSession({
    secret: config.sessionSecret
  }));

  app.use(passport.initialize());

  app.use(passport.session());

  app.phase(bootable.initializers('setup/initializers/'));

  app.all('/', function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "X-Requested-With");
    return next();
  });

  app.get('/', function(req, res) {
    return res.render('home', {
      isAuth: req.isAuthenticated()
    });
  });

  app.get('/secure', function(req, res) {
    return res.send('secure');
  });

  app.get('/auth/vkontakte', passport.authenticate('vkontakte', {
    scope: ['friends']
  }), function(req, res) {
    return res.end('LOOOL');
  });

  app.get('/auth/vkontakte/callback', passport.authenticate('vkontakte', {
    failureRedirect: '/login'
  }), function(req, res) {
    return res.redirect('/');
  });

  app.get('/login', function(req, res) {
    return res.render('login');
  });

  app.use(function(req, res) {
    return res.status(404).render('404', {
      title: '404: File Not Found'
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
    if (err.code === "VKSecurity") {
      return res.render('vkFinish', {
        vkRedirect: err.redirect_uri
      });
    }
    return res.status(500).render('500', {
      title: '500: server errro',
      message: err
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
