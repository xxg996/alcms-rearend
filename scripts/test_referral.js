require('dotenv').config();

const authController = require('../src/controllers/authController');
const cardKeyController = require('../src/controllers/cardKeyController');
const Referral = require('../src/models/Referral');
const CardKey = require('../src/models/CardKey');
const User = require('../src/models/User');
const { query, closePool } = require('../src/config/database');

function createMockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    }
  };
  return res;
}

async function run() {
  let exitCode = 0;
  try {
    const inviterId = 1;
    const referralCode = await Referral.ensureCode(inviterId, false);
    console.log('[测试] 上级账号ID=', inviterId, '邀请码=', referralCode);

    const timestamp = Date.now();
    const newUserData = {
      username: `invite_user_${timestamp}`,
      email: `invite_user_${timestamp}@example.com`,
      password: 'TestPass123',
      nickname: '被邀请用户',
      invite_code: referralCode
    };

    const reqRegister = { body: newUserData };
    const resRegister = createMockRes();
    await authController.register(reqRegister, resRegister);

    if (!resRegister.body?.success) {
      throw new Error('注册接口返回失败: ' + JSON.stringify(resRegister.body));
    }

    console.log('[测试] 注册返回状态=', resRegister.statusCode);
    const newUserId = resRegister.body.data.user.id;
    console.log('[测试] 新用户ID=', newUserId);

    const inviterRelation = await query(
      'SELECT inviter_id FROM users WHERE id = $1',
      [newUserId]
    );
    console.log('[验证] 数据库中 inviter_id =', inviterRelation.rows[0].inviter_id);

    const cardKey = await CardKey.createCardKey({
      type: 'vip',
      vip_level: 1,
      vip_days: 30
    }, inviterId);
    console.log('[测试] 生成卡密 code=', cardKey.code);

    const reqRedeem = {
      body: { code: cardKey.code },
      user: await User.findById(newUserId)
    };
    const resRedeem = createMockRes();
    await cardKeyController.redeemCard(reqRedeem, resRedeem);

    if (!resRedeem.body?.success) {
      throw new Error('卡密兑换失败: ' + JSON.stringify(resRedeem.body));
    }

    console.log('[测试] 兑换返回 message=', resRedeem.body.message);
    console.log('[测试] 佣金返回数据=', resRedeem.body.data.commission);

    const commissionRows = await query(
      'SELECT inviter_id, invitee_id, order_amount, commission_amount, event_type FROM referral_commissions ORDER BY id DESC LIMIT 1'
    );
    console.log('[验证] 最新佣金记录=', commissionRows.rows[0]);

    const inviterStats = await query(
      'SELECT commission_balance, total_commission_earned FROM users WHERE id = $1',
      [inviterId]
    );
    console.log('[验证] 上级佣金余额=', inviterStats.rows[0]);
  } catch (error) {
    console.error('[测试] 执行失败:', error);
    exitCode = 1;
  } finally {
    await closePool();
    process.exit(exitCode);
  }
}

run();
