/**
 * 搜索统计路由
 */

const express = require('express');
const SearchController = require('../controllers/searchController');

const router = express.Router();

router.get('/hot', SearchController.getHotSearches);

module.exports = router;
