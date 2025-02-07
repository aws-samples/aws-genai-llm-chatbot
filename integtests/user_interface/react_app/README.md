### How to run the end to end tests
* Download and install [geckodriver](https://github.com/mozilla/geckodriver). For example on mac, run `brew install geckodriver`
* Start it by running `geckodriver`
* (Optional for remote developmment) Use a ssh tunnel so the browser is visible on your laptop instead of your remote machine
``` ssh -N -T -C -R 4444:localhost:4444  remote-host```
* Authenticate against your AWS account. The tests need to create a cognito user.
* Ran the tests
```
REACT_APP_URL=https://dxxxxxxxxxxxxx.cloudfront.net pytest integtests/user_interface/
```
or for local development
```
REACT_APP_URL=http://localhost:3000  pytest integtests/user_interface/
```