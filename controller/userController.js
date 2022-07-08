const jwt = require('jsonwebtoken');
const userDB = require('../models/user');
const Joi = require('joi');
const bcrypt = require('bcrypt');
const mailer = require('../models/mail');
const secret = require('../config/secret.json');
// const send_message = require('../module/sms'); //sms module

require('dotenv').config();

const UserSchema = Joi.object({
    name: Joi.string().required(),

    email: Joi.string()
        .required()
        .pattern(new RegExp('^[0-9a-zA-Z]+@+[0-9a-zA-Z]+.+[a-zA-Z]$')),

    nickname: Joi.string()
        .required()
        .pattern(new RegExp('^[ㄱ-ㅎ가-힣0-9a-zA-Z]{3,10}$')),

    password: Joi.string()
        .required()
        .pattern(new RegExp('^[ㄱ-ㅎ가-힣0-9a-zA-Z@$!%#?&]{4,10}$')),

    confirmPassword: Joi.string().required().min(3),

    phoneNum: Joi.number().min(8),
}).unknown(); // 정의되지 않은 key도 허용

//회원가입
exports.signUp = async(req, res) => {
    try {
        let { name, email, nickname, phoneNum, password, faceColor, eyes } =
        await UserSchema.validateAsync(req.body);

        // const existUsers = await userDB.findOne({ userId });
        // if (existUsers) {
        //     return res.status(400).send({ errorMessage: '중복된 아이디입니다.' });
        // }

        const existNickname = await userDB.findOne({ nickname });
        if (existNickname) {
            return res
                .status(400)
                .send({ errorMessage: '중복된 닉네임입니다.' });
        }

        password = bcrypt.hashSync(password, 10);

        const users = new userDB({
            name,
            email,
            nickname,
            password,
            phoneNum,
            faceColor,
            eyes,
        });

        await users.save();

        res.status(201).send({ message: '회원가입에 성공했습니다.' });
    } catch (err) {
        res.status(400).send({
            errorMessage: '요청한 데이터 형식이 올바르지 않습니다.',
        });
    }
};

//이메일, 비밀번호 중복확인API
exports.check = async(req, res) => {
    const { email, password, confirmPassword } = await UserSchema.validateAsync(
        req.body
    );

    const existUsersEmail = await userDB.findOne({ email });
    try {
        if (existUsersEmail) {
            return res
                .status(400)
                .send({ errorMessage: '중복된 이메일입니다.' });
        }

        if (password !== confirmPassword) {
            return res.status(400).send({
                errorMessage: '비밀번호와 비밀번호 확인의 내용이 일치하지 않습니다.',
            });
        }
        res.status(200).send({ result: success });
    } catch (err) {
        console.log(err);
        res.send({ result: false });
    }
};

// 인증번호 메일로 보내기
exports.sendMail = async(req, res) => {
    const { email } = req.body; //회원가입시 입력한 정보 가져오기
    const authNum = Math.random().toString().substring(2, 6); //랜덤한 숫자 4자리 생성

    const existUsersEmail = await userDB.findOne({ email });

    const emailParam = {
        toEmail: email,
        subject: '위잇 인증번호 발급',
        text: `
                안녕하세요 위잇에서 인증번호 발급을 도와드릴게요!

                인증번호는 <  ${authNum}  > 입니다.

                인증번호 입력란에 입력해 주세요! :)`,
    };

    try {
        if (existUsersEmail) {
            return res
                .status(400)
                .send({ errorMessage: '중복된 이메일입니다.' });
        }

        if (!existUsersEmail) {
            mailer.sendEmail(emailParam);

            res.status(200).send({ msg: `메일 보내기 성공!`, authNum });
        }
    } catch (error) {
        res.status(500).send({ errorMessage: '메세지 전송 싪패!' });
    }
};

//로그인
exports.login = async(req, res) => {
    const { email, password } = req.body;
    const user = await userDB.findOne({ email });
    try {
        if (!email || !password) {
            return res
                .status(400)
                .send({ errorMessage: '입력칸을 채워주세요!' });
        }

        if (!user) {
            return res
                .status(400)
                .send({ errorMessage: '회원정보가 없습니다!' });
        }

        const userCompared = await bcrypt.compare(password, user.password);
        if (!userCompared) {
            return res.status(400).send({
                errorMessage: '이메일이나 비밀번호가 올바르지 않습니다.',
            });
        }

        //비밀번호까지 맞다면 토큰을 생성하기.
        const token = jwt.sign({ userId: user.userId }, secret.SECRET_KEY, {
            expiresIn: '3d',
        });
        res.status(200).send({
            message: `${email}님이 로그인하셨습니다.`,
            token,
        });
    } catch (err) {
        res.status(400).json({
            fail: '입력창을 확인 해주세요.',
        });
    }
};

//아이디 찾기 - 핸드폰 인증번호 구현할 시 email => phoneNum으로 바꾸기
exports.findUserId = async(req, res) => {
    const { email } = req.body;

    const existUsersEmail = await userDB.findOne({ email });

    if (!existUsersEmail || existUsersEmail === null) {
        return res.status(400).send({ errorMessage: '아이디 찾기 실패!' });
    }
    const name = existUsersEmail.name;

    return res.status(200).json({ msg: '아이디 찾기 성공!', name });
};

//비밀번호 찾기
exports.findPass = async(req, res) => {
    const { email, name } = req.body;

    //랜덤으로 36진수의 값 만들기(소숫점 뒤부터)
    let tempPassword = Math.random().toString(36).slice(2);

    const existUserPass = await userDB.findOne({ email, name });

    if (!existUserPass || existUserPass === null) {
        return res.status(400).send({
            errorMessage: '작성란이 비어있거나 회원등록이 되어있지 않는 사용자입니다.',
        });
    }

    //임시비밀번호 이메일로 전송
    const emailParam = {
        toEmail: email,
        subject: '위잇 임시비밀번호 발급',
        text: `
                안녕하세요 ${name}님! 임시비밀번호를 보내드려요!
        
                임시비밀번호는 <  ${tempPassword}  > 입니다.
        
                입력 후 회원정보란에서 꼭 변경해주시길 바랍니다! :)`,
    };

    try {
        mailer.sendEmail(emailParam);

        res.status(200).send({ msg: `메일 보내기 성공!` });
        //메일 보내기
    } catch (error) {
        res.status(500).send({ errorMessage: '메세지 전송 싪패!' });
    }

    if (existUserPass) {
        //임시로 발급된 비밀번호 암호화
        tempPassword = bcrypt.hashSync(tempPassword, 10);

        //등록된 비밀번호를 임시비밀번호로 수정
        await userDB.findByIdAndUpdate(existUserPass, {
            $set: { password: tempPassword },
        });
    } else {
        return res.status(400).send({ errorMessage: '비밀번호 찾기 실패!' });
    }
};

//SMS 문자 인증
// exports.sendSMS = (req, res) => {
//     const { phoneNum } = req.body;
//     const authNum = Math.random().toString().substring(2, 6);

//     try {
//         if (phoneNum) {
//             send_message(authNum, phoneNum);
//             res.status(200).send({ msg: '문자보내기 성공!', authNum });
//         }
//     } catch (error) {
//         res.status(500).send({ errorMessage: '문자보내기 실패' });
//         console.log(error);
//     }
// };

//프로필 수정
exports.userinfoEdit = async(req, res) => {
    const { email } = res.locals.user;
    const { nickname, userImageURL, userInfo, password } = req.body;

    const existNickname = await userDB.findOne({ nickname });
    const users = await userDB.findOne({ email });

    try {
        if (existNickname) {
            return res
                .status(400)
                .send({ errorMessage: '중복된 닉네임입니다.' });
        }

        if (users.email === email && !password && !existNickname) {
            await userDB.findByIdAndUpdate({ _id: users._id }, {
                $set: {
                    userImageURL: userImageURL,
                    userInfo: userInfo,
                    nickname: nickname,
                },
            });
            return res.status(201).json({
                msg: '회원정보가 수정되었습니다.',
            });
        }

        if (users.email === email && password && !existNickname) {
            await userDB.findByIdAndUpdate({ _id: users._id }, {
                $set: {
                    userImageURL: userImageURL,
                    userInfo: userInfo,
                    nickname: nickname,
                    password: bcrypt.hashSync(password, 10),
                },
            });

            return res.status(201).json({
                msg: '회원정보가 수정되었습니다.',
            });
        }

        res.status(400).send({ errorMessage: '회원정보 수정 실패!' });
    } catch (error) {
        res.status(500).send({ errorMessage: '예외처리 에러' });
    }
};

//사용자 인증
exports.userInfo = async(req, res) => {
    const { user } = res.locals;
    res.send({
        user: {
            userId: user.userId,
            email: user.email,
            name: user.name,
            nickname: user.nickname,
            faceColor: user.faceColor,
            eyes: user.eyes,
        },
    });
};