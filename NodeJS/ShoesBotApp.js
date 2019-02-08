'use strict'

const express = require('express')
const bodyParser = require('body-parser')
const request = require('request')
const jsonfile = require('jsonfile');
const app = express();
const fs = require('fs');
const https = require('https');

// set the Facebook Messenger Token
const token = "FB_MESSENGER_TOKEN"
// Set the Cloud Foundry OCR App URL with base authentication type
const host = "appnode-demo-pxxxx4trial.cfapps.eu10.hana.ondemand.com";
const uid = "SAP_CLOUD_FOUNDRY_USER_ID";
const pwd = "SAP_CLOUD_FOUNDRY_PASSWORD";

let ArrayData = [];
const chunk_size = 10;
let groups;
let aritem = ["Oops, I can't find best product. Please try again with different image"];

app.set('port', (process.env.PORT || 5000))
// Process application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({
    extended: false
}))
// Process application/json
app.use(bodyParser.json())
// Index route
app.get('/', function(req, res) {
    res.send('Hello world, I am a Facebook Messenger Receipt Scan Bot')
})

// for Facebook verification
app.get('/webhook/', function(req, res) {
    if (req.query['hub.verify_token'] === 'my_voice_is_my_password_verify_me') {
        res.send(req.query['hub.challenge'])
    }
    res.send('Error, wrong token')
})

function sendImageText(sender, element) {
    request({
        url: 'https://graph.facebook.com/v2.6/me/messages',
        qs: {
            access_token: token
        },
        method: 'POST',
        json: {
            recipient: {
                id: sender
            },
            message: {
                attachment: {
                    type: 'template',
                    payload: {
                        template_type: 'generic',
                        elements: element
                    }
                }
            }
        }
    }, function(error, response, body) {
        if (error) {
            console.log('Error sending messages: ', error)
        } else if (response.body.error) {
            console.log('Error: ', response.body.error)
        }
    })
}

function sendMsg(data, sender, cb) {
	request({
        url: 'https://graph.facebook.com/v2.6/me/messages',
        qs: {access_token:token},
        method: 'POST',
         json: {
			recipient: { id: sender },
			message:{
				attachment: {
				  type: 'template',
				  payload: {
					  template_type: 'generic',
					  elements: data
				  }
				}
			}
		}
    }, function(error, response, body) {
        if (error) {
            console.log('Error sending messages: ', error)
        } else if (response.body.error) {
            console.log('Error: ', response.body.error)
        } else {
        	cb();
        }
    })
}

function getProfile(id, cb) {
    request({
        method: 'GET',
        uri: `https://graph.facebook.com/v2.6/${id}`,
        qs: _getQs({
            fields: 'first_name,last_name,profile_pic,locale,timezone,gender'
        }),
        json: true
    }, function(error, response, body) {
        if (error) return cb(error)
        if (body.error) return cb(body.error)

        cb(body)
    })
}

function _getQs(qs) {
    if (typeof qs === 'undefined') {
        qs = {}
    }
    qs['access_token'] = token

    return qs
}

function sendTextMessage(sender, text, cb) {
    let messageData = {
        text: text
    }
    request({
        url: 'https://graph.facebook.com/v2.6/me/messages',
        qs: {
            access_token: token
        },
        method: 'POST',
        json: {
            recipient: {
                id: sender
            },
            message: messageData,
        }
    }, function(error, response, body) {
        if (error) {
            console.log('Error sending messages: ', error)
        } else if (response.body.error) {
            console.log('Error: ', response.body.error)
        }
        cb();
    })
}

function sendImage(sender, imageURL, cb) {
    request({
        url: 'https://graph.facebook.com/v2.6/me/messages',
        qs: {
            access_token: token
        },
        method: 'POST',
        json: {
            recipient: {
                id: sender
            },
            message: {
                attachment: {
                    type: 'image',
                    payload: {
                        url: imageURL
                    }
                }
            }
        }
    }, function(error, response, body) {
        if (error) {
            console.log('Error sending messages: ', error)
        } else if (response.body.error) {
            console.log('Error: ', response.body.error)
        }
        cb();
    })
}

function senderAction(sender, payload) {
    request({
        method: 'POST',
        uri: 'https://graph.facebook.com/v2.6/me/messages',
        qs: {
            access_token: token
        },
        json: {
            recipient: {
                id: sender
            },
            sender_action: payload
        }
    }, function(error, response, body) {
        if (error) {
            console.log('Error sending messages: ', error)
        } else if (response.body.error) {
            console.log('Error: ', response.body.error)
        }
    })
}

function sendQuickReply(sender, text, title, payload) {
    request({
        url: 'https://graph.facebook.com/v2.6/me/messages',
        qs: {
            access_token: token
        },
        method: 'POST',
        json: {
            recipient: {
                id: sender
            },
            message: {
                text: text,
                quick_replies: [{
                    content_type: 'text',
                    title: title,
                    payload: payload
                }]
            }
        }
    }, function(error, response, body) {
        if (error) {
            console.log('Error sending messages: ', error)
        } else if (response.body.error) {
            console.log('Error: ', response.body.error)
        }
    })
}

function sleep(milliseconds) {
    var start = new Date().getTime();
    for (var z = 0; z < 1e7; z++) {
        if ((new Date().getTime() - start) > milliseconds) {
            break;
        }
    }
}

function sendTextMessages(sender, text, i) {
    if (i < text.length) {
        request({
            url: 'https://graph.facebook.com/v2.6/me/messages',
            qs: {
                access_token: token
            },
            method: 'POST',
            json: {
                recipient: {
                    id: sender
                },
                message: {
                    text: text[i]
                },
            }
        }, function(error, response, body) {
            if (error) {
                console.log('Error sending messages: ', error)
            } else if (response.body.error) {
                console.log('Error: ', response.body.error)
            }
            sendTextMessages(sender, text, i + 1)
            sleep(1000);
        })
    } else return
}

let SAPOCR = false;

app.post('/webhook/', function(req, res) {
    let messaging_events = req.body.entry[0].messaging
    for (let i = 0; i < messaging_events.length; i++) {
        let event = req.body.entry[0].messaging[i]
        let sender = event.sender.id
        //console.log(event);

        if (event.postback) {
            let text = JSON.parse(JSON.stringify(event.postback));

            if (text.payload == 'USER_DEFINED_PAYLOAD') {

                let ArrayData = [];
                ArrayData.push({
                    'title': 'Hi! My name is ShoesBot ðŸ».',
                    'subtitle': 'Send me your image of shoes and I recommend the best shoes for you!',
                });

                sendImageText(sender, ArrayData, (err) => {
                    if (err) {
                        console.log(err);
                    }
                })
                senderAction(sender, 'typing_off');
            }
        }


        //Sticker
        let sticker = false;
        if (event.message && event.message.sticker_id == '369239383222810') {
            sendTextMessage(sender, 'ðŸ‘', function(returnValue) {});
            sticker = true;
        }
        if (event.message && event.message.sticker_id == '369239343222814') {
            sendTextMessage(sender, 'ðŸ‘', function(returnValue) {});
            sticker = true;
        }
        if (event.message && event.message.sticker_id == '369239263222822') {
            sendTextMessage(sender, 'ðŸ‘', function(returnValue) {});
            sticker = true;
        }


        if (event.message && event.message.attachments) {
            if (event.message.attachments[0].type === "image") {
                let imageURL = event.message.attachments[0].payload.url;
                console.log(imageURL);

                /*
                //For local testing
                request('http://localhost:3000?url=' + imageURL, { json: true }, (err, res, body) => {
                  if (err) { return console.log(err); }
                  console.log(body);
                  sendTextMessage(sender, body.result.ocr, function(returnValue) {
                  })
                });
                */

                let options = {
                    host: host,
                    path: '/img?url=' + imageURL,
                    headers: {
                        'Authorization': 'Basic ' + new Buffer(uid + ':' + pwd).toString('base64')
                    }
                };

                https.get(options, function(res) {
                    let body = "";
                    res.on('data', function(data) {
                        body += data;
                    });
                    res.on('end', function() {
                        let result = JSON.parse(body);
						console.log(result.result.distances.length);

						ArrayData = [];

						for(let k=0; k<result.result.distances.length; k++) {
							let image_url = result.result.img_path[k];
							image_url = image_url.split('\\')[1];

							image_url = 'https://xxxxtrial.dispatcher.hanatrial.ondemand.com/img/' + image_url;
							console.log(image_url);

							ArrayData.push({
								'title': 'Product',
								'subtitle': 'Sub Title',
								'image_url': image_url,
								"buttons":[{
									"type":"web_url",
									"url":  'https://dummy.com',
									"title": 'Detail Product'
									}
								]
							});
						}

                        if (ArrayData.length > 0) {
							sendTextMessage(sender, 'Showing the result...', function(returnValue) {
								groups = ArrayData.map( function(e,i){ 
									return i%chunk_size===0 ? ArrayData.slice(i,i+chunk_size) : null; 
								})
								.filter(function(e){ return e; });
									for (let p=0; p<groups.length; p++){
									sendMsg(groups[p], sender, function(returnValue) {
									});
								}
							});
						}
						else 
							sendTextMessages(sender, aritem, false, 0);
                    })
                    res.on('error', function(e) {
                        console.log("Got error: " + e.message);
                    });
                });

            }
        }

    }
    res.sendStatus(200)
})

// Spin up the bot
app.listen(app.get('port'), function() {
    console.log('FB Messenger Bot is running on port', app.get('port'))
})
