const https = require('https');

exports.APIRequest = (url, options, data = null) => {
 if(data && !((typeof (data) == 'string') || (data instanceof Buffer)))
  throw 'Los datos deben ser una cadena o un búfer.'

 return new Promise((resolve, reject) => {
  const request = https.request(url, options, resp => {
   const DataResult = (result = null) => ((resp.statusCode >= 200) && (resp.statusCode < 300)) ? resolve(result) : reject({
    code: resp.statusCode,
    ext: resp.statusMessage,
    data: result
   });

   const amount = [];
   let dataLength = 0;

   resp.on('data', data => {
    amount.push(data);
    dataLength += data.length;
   });

   resp.on('end', () => {
    if(!resp.complete)
     return reject('Error de respuesta.');
    
    if(dataLength == 0)
     return DataResult();

    if (amount.length == 1)
     return DataResult(amount[0]);
    
    const data = Buffer.allocUnsafe(dataLength);
    let len = 0;
    for (let index = 0; index < amount.length; index++) {
     const amount = amount[index];
     amount.copy(data, len);
     len += amount.length;
     
    }
    return DataResult(data);

   });
  });

  request.on('error', () => reject('Solicitud de error.'));
  request.on('timeout', () => reject(1));
  request.end(data);

 });
}