const aws = require('aws-sdk');
const lambda = new aws.Lambda();
const ssm = new (require('aws-sdk/clients/ssm'))();

exports.handler = async (event, context, callback) => {

//const token = "2noze45lH4U6Gj8i6BgQJ1Sk";
    const param = await ssm.getParameter({
        "Name": process.env["PSKEY_SLACK_TOKEN"],
        "WithDecryption": true
      }).promise();
    const token = param.Parameter.Value;
    
    if (event.type === 'url_verification') {
    	callback(null, {'challenge': event.challenge });
    } else {
        console.log(event);
    	const params = {
    		FunctionName: 'sendToLINEWORKS',
    		InvocationType: 'Event', 
    		Payload: JSON.stringify({
    			message: event.event,
    		})
    	};

        let body;
        if (event.token === token) {
            const result = await lambda.invoke(params).promise();
        	body = JSON.stringify(result.Payload);
        } else {
            body = {"message":"Token not verfied."}
        };
    	callback(null, body.message);
    };
};
