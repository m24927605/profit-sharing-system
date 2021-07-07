# Profit Sharing System

## Step
1. Run up docker container,command:
```
docker-compose up -d
```

2. Checkout postman folder and there is a file(API-collection.json),please import the file to postman app.

3. You could test API in postman manually.

## Configuration
### Database
```
DB_HOST=localhost
DB_PORT=3306
DB_USER=user
DB_PASSWORD=password
DB_DATABASE=thundercore
```

## API Feature
1. Only POST /managers, POST /manager/login no needs to do API authentication.
2. Suggest test the API by the sequence in API-collection.
3. Please add managers and users by calling API first.  
4. There is a cronjob run in the backround to do a auto task for the exam operation.