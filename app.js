const express = require('express');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const path = require('path');
const Arweave = require('arweave/node');
var bodyParser = require('body-parser');
var fs = require('fs');

const app = express();
const arweave = Arweave.init({
	host: 'arweave.net',
	port: 443,
	protocol: 'https'
});

app.set('views', path.join(__dirname, 'views'));
app.set('view engine' , 'pug');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(session({secret: "Very secret key"}));

async function getTransactionsByAddress(address) {
	const query = {
		op: 'equals',
		expr1: 'from',
		expr2: address
	};
	const res = await arweave.api.post('arql', query);

	let links = [];
	if(res.data && res.data.length) {
		links = await Promise.all(res.data.map(async linkId => {
			return linkId;
		}));
	}

	return links;
}

app.get('/', function(req, res){
	if(req.session.logged){
		getTransactionsByAddress(req.session.address).then((links) => {
			return res.render('index', {logged: req.session.logged, txs: links});
		});
	}
	else{
		return res.render('index', {logged: req.session.logged});
	};
});

app.post('/', function(req, res){
	if(req.body.key && typeof req.session.logged !== undefined){
		var jwk = JSON.parse(req.body.jwk);
		arweave.wallets.jwkToAddress(jwk).then((address) => {
        req.session.logged = true;
				req.session.address = address;
				req.session.key = jwk;
				req.session.save();
    }).catch((error) => {
			console.log(error);
		});
	}
	else if(req.body.title && req.session.logged){
		arweave.createTransaction({data: req.body.title + '|' + req.body.subject}, req.session.key).then((transaction) =>{
			arweave.transactions.sign(transaction, req.session.key).then((signedtransaction) => {
				arweave.transactions.post(transaction).then((response) => {
					console.log(response.status);
				}).catch((error) => {
					console.log(error);
				});
			}).catch((error) => {
				console.log(error);
			});
		}).catch((error) => {
			console.log(error);
		});
	}
	return res.redirect('/')
});

app.all('/confession/:txid', function(req, res){
	var txid = req.params.txid;
	var title = '';
	var subject = '';
	arweave.transactions.get(txid).then((transaction) => {
		var data = transaction.get('data', {decode: true, string: true}).split('|');
		title = data[0];
		subject = data[1];
		return res.render('confession', {logged: req.session.logged, title: title, subject: subject});
	}).catch((error) => {
		console.log(error);
		return res.redirect('/');
	});
});

app.all('/logout', function(req, res){
	req.session.destroy()
	return res.redirect('/');
});

app.listen(process.env.PORT || 4000, function(){
	console.log('Server started on port')
});
