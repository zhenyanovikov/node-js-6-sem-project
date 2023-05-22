const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const swaggerDocument = YAML.load('./swagger.yaml');

const port = 3000;

const app = express();
app.use(express.json());

// Підключення до бази даних MongoDB
mongoose.connect('mongodb://localhost:27017/', {useNewUrlParser: true, useUnifiedTopology: true})
    .then(() => console.log('Connected to MongoDB'))
    .catch(error => console.error('Failed to connect to MongoDB', error));

// Модель користувача
const userSchema = new mongoose.Schema({
    username: String,
    password: String
});

const User = mongoose.model('User', userSchema);

// Модель завдання
const taskSchema = new mongoose.Schema({
    title: String,
    description: String,
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
});

const Task = mongoose.model('Task', taskSchema);

// openapi 3 docs from yaml
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Реєстрація нового користувача
app.post('/users/register', async (req, res) => {
    try {
        const {username, password} = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);

        const user = new User({username, password: hashedPassword});
        await user.save();

        res.status(201).json({message: 'User registered successfully'});
    } catch (error) {
        res.status(500).json({error: 'Failed to register user'});
    }
});

// Аутентифікація користувача
app.post('/users/login', async (req, res) => {
    try {
        const {username, password} = req.body;
        const user = await User.findOne({username});

        if (!user) {
            return res.status(401).json({error: 'Authentication failed'});
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({error: 'Authentication failed'});
        }

        const token = jwt.sign({userId: user._id}, 'secret-key');
        res.json({token});
    } catch (error) {
        res.status(500).json({error: 'Failed to authenticate'});
    }
});

// Перевірка токена перед кожним запитом до захищених маршрутів
app.use((req, res, next) => {
    try {
        const token = req.headers.authorization.split(' ')[1];
        const decodedToken = jwt.verify(token, 'secret-key');
        req.userData = {userId: decodedToken.userId};
        next();
    } catch (error) {
        res.status(401).json({error: 'Authentication failed'});
    }
});

// Створення завдання
app.post('/tasks', async (req, res) => {
    try {
        const {title, description} = req.body;
        const userId = req.userData.userId;

        const task = new Task({title, description, userId});
        await task.save();

        res.status(201).json({message: 'Task created successfully'});
    } catch (error) {
        res.status(500).json({error: 'Failed to create task'});
    }
});

// Отримання всіх завдань користувача
app.get('/tasks', async (req, res) => {
    try {
        const userId = req.userData.userId;
        const tasks = await Task.find({userId});
        res.json(tasks);
    } catch (error) {
        res.status(500).json({error: 'Failed to fetch tasks'});
    }
});

// Оновлення завдання
app.put('/tasks/:taskId', async (req, res) => {
    try {
        const {taskId} = req.params;
        const {title, description} = req.body;
        const userId = req.userData.userId;

        const task = await Task.findOne({_id: taskId, userId});
        if (!task) {
            return res.status(404).json({error: 'Task not found'});
        }

        task.title = title;
        task.description = description;
        await task.save();

        res.json({message: 'Task updated successfully'});
    } catch (error) {
        res.status(500).json({error: 'Failed to update task'});
    }
});

// Видалення завдання
app.delete('/tasks/:taskId', async (req, res) => {
    try {
        const {taskId} = req.params;
        const userId = req.userData.userId;

        const task = await Task.findOneAndRemove({_id: taskId, userId});
        if (!task) {
            return res.status(404).json({error: 'Task not found'});
        }

        res.json({message: 'Task deleted successfully'});
    } catch (error) {
        res.status(500).json({error: 'Failed to delete task'});
    }
});


app.listen(port, () => console.log(`Server is running on port ${port}`));
