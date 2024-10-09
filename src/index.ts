import { TIMEOUT } from 'dns';
import { Session } from 'inspector/promises';
import { Context, Schema ,Database,$,h } from 'koishi';
import { } from 'koishi-plugin-puppeteer'
import { config } from 'process';
import type { Page } from 'puppeteer-core'
import { arrayBuffer } from 'stream/consumers';
import path from 'path'
import fs from 'fs';
const fsPromises = fs.promises;

const koishi = require("koishi");

//const fontPath = path.resolve(__dirname, './font/seguiemj.TTF');
const fontPath = require.resolve('../font/seguiemj.ttf');
const fontBase64 = fs.readFileSync(fontPath, {encoding: 'base64'});

export const inject = {required:["database"],optional: ['puppeteer']}
export const name = 'ddnetfriends';
export const Config: Schema<Config> = Schema.object({
  useimage: Schema.boolean().description('是否使用图片样式').default(true),
  enablewarband: Schema.boolean().description('是否显示战队(返回的数据以官网为准,如果好友不是该战队,可能是别人恰分改的ID？)').default(true),
  enableemoji: Schema.boolean().description('是否开启emoji,改善有些id或战队使用emoji表情的显示情况,但是有可能会影响加载速度(maybe)').default(false),
  Special_Attention:Schema.boolean().description('是否推送关注用户上线消息,发送失败的话可能要加机器人为好友(因为是私聊),如果关闭的话以下内容不会生效').default(false),
  Special_Attention_Interval_time:Schema.number().description('默认每个关注对象推送间隔为12小时(如果推送过一次之后则下次直到12小时后上线才推送').default(12),
  Special_Attention_listening:Schema.number().description('默认监听间隔,降低这个值可以减少查询的频率,默认监听间隔3分钟').default(3)
});


export interface Config {
  useimage: boolean
  enablewarband:boolean
};

declare module 'koishi' {
  interface Tables {
    ddnetfriendsdata: ddnetfriendsdata,
    ddnet_group_data:ddnet_group_data
  }
}

export interface ddnetfriendsdata {
  id: number
  userid:string
  friendname: string
  playername:string
  Special_Attention:string

}

export interface ddnet_group_data {
  id: number
  user_id: string
  last_sent_time:string
  friendname:string
}
//const import_koishi = require("koishi");

//看调用私聊还是群聊
async function sendMessage(session,message) {
  try {
    if (session.event.channel.type === 1) {
      // 私聊
      await session.bot.sendPrivateMessage(session.userId,message);
    } else {
      // 群聊
      await session.send(message);
      
    }
  } catch (error) {
    console.error('发送消息时出错:', error);
  }
}

//关注玩家
async function updateSpecialAttention(ctx, userid, special_attention,session) {
  const userId = userid;
  const friendName = special_attention[0];

  // 尝试查找匹配的记录
  const existingRecord = await ctx.database.get('ddnetfriendsdata', {
    userid: userId,
    friendname: friendName
  });

  if (existingRecord.length > 0) {
    // 如果记录存在，检查 Special_Attention 字段
    if (existingRecord[0].Special_Attention === 'yes') {
      return await sendMessage(session,'已经关注过这个人了哦');
      
    }

    // 如果未关注，更新 Special_Attention 字段
    await ctx.database.set('ddnetfriendsdata', {
      userid: userId,
      friendname: friendName
    }, {
      Special_Attention: 'yes'
    });

  } else {
    // 如果记录不存在，创建新记录
    await ctx.database.create('ddnetfriendsdata', {
      userid: userId,
      friendname: friendName,
      Special_Attention: 'yes'
    });
  }
  return await sendMessage(session,'关注完成:' + special_attention);
}

//取消关注
async function cancelSpecialAttention(ctx,userid, special_attention,session) {
  const userId = userid;
  const friendName = special_attention[0];

  // 尝试查找匹配的记录
  const existingRecord = await ctx.database.get('ddnetfriendsdata', {
    userid: userId,
    friendname: friendName
  });

  if (existingRecord.length === 0 || (existingRecord.length > 0 && existingRecord[0].Special_Attention === '')) {
    return await sendMessage(session,'你根本没有关注这个人！');
  }

  if (existingRecord.length > 0) {
    await ctx.database.set('ddnetfriendsdata', {
      userid: userId,
      friendname: friendName
    }, {
      Special_Attention: ''
    });
    return await sendMessage(session,'取消关注:' + friendName);
  }
}


//未完成地图
async function fetchPlayerData(ctx, playerId, select, session) {
  try {
    const data = await ctx.http.get(`https://ddnet.org/players/?json2=${playerId}`, { responseType: 'json' });
    
    if (Object.keys(data).length === 0) {
      await sendMessage(session, `未查询到玩家ID: ${playerId}`);
      return;
    }

    const selectNum = parseInt(select, 10);

    let mapType;
    switch (selectNum) {
      case 1: mapType = 'Novice'; break;
      case 2: mapType = 'Moderate'; break;
      case 3: mapType = 'Brutal'; break;
      case 4: mapType = 'Insane'; break;
      case 5: mapType = 'Oldschool'; break;
      case 7: mapType = 'Dummy'; break;
      case 8: mapType = 'Solo'; break;
      case 9: mapType = 'Race'; break;
      case 6: 
        const ddmaxTypes = ['DDmaX.Easy', 'DDmaX.Next', 'DDmaX.Pro', 'DDmaX.Nut'];
        let unfinishedMaps = [];
        ddmaxTypes.forEach(type => {
          if (data.types && data.types[type] && data.types[type].maps) {
            const maps = data.types[type].maps;
            Object.keys(maps)
              .filter(map => maps[map].finishes === 0)
              .forEach(map => unfinishedMaps.push(`${map}(${maps[map].points} points - ${type})`));
          }
        });
        if (unfinishedMaps.length > 0) {
          await sendMessage(session, `${playerId} 在古典系列中尚未完成的地图，共计${unfinishedMaps.length}张:\n${unfinishedMaps.join('\n')}`);
        } else {
          await sendMessage(session, `${playerId} 已完成所有古典系列的地图。`);
        }
        return;
      default:
        await sendMessage(session, '无效的选择，请选择1-9之间的数字。');
        return;
    }

    if (data.types && data.types[mapType] && data.types[mapType].maps) {
      const maps = data.types[mapType].maps;
      const unfinishedMaps = Object.keys(maps)
        .filter(map => maps[map].finishes === 0)
        .map(map => `${map}(${maps[map].points} points)`);

      if (unfinishedMaps.length > 0) {
        await sendMessage(session, (0, koishi.h)('message', { forward: true }, `${playerId} 在${mapType}类型中尚未完成的地图，共计${unfinishedMaps.length}张:\n${unfinishedMaps.join('\n')}`));
      } else {
        await sendMessage(session, `${playerId} 已完成所有${mapType}类型的地图。`);
      }
    } else {
      await sendMessage(session, `无法获取 ${playerId} 的${mapType}地图数据。`);
    }
  } catch (error) {
    ctx.logger.error('获取数据时出错:', error);
    await sendMessage(session, `获取数据时出错: ${error.message}`);
  }
}


//好友列表
async function ddlist(ctx) {
  const urls = [
    'https://master1.ddnet.org/ddnet/15/servers.json',
    'https://master2.ddnet.org/ddnet/15/servers.json',
    'https://master3.ddnet.org/ddnet/15/servers.json',
    'https://master4.ddnet.org/ddnet/15/servers.json',
    'https://master5.ddnet.org/ddnet/15/servers.json'
  ];

  const timeout = 10000; // 10秒超时
  const maxRetries = 3; // 最大重试次数

  const fetchWithRetry = async (url) => {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const result = await ctx.http.get(url, {
          responseType: 'json',
          timeout: timeout
        });
        return result; // 如果成功，立即返回结果
      } catch (error) {
        //ctx.logger.warn(`请求 ${url} 失败 (尝试 ${i + 1}/${maxRetries}): ${error.message}`);
        if (i === maxRetries - 1) {
          throw error; // 如果是最后一次尝试，抛出错误
        }
      }
    }
  };

  const raceToSuccess = (promises) => {
    return new Promise((resolve, reject) => {
      let rejectionCount = 0;
      promises.forEach(promise => {
        promise.then(resolve).catch(error => {
          rejectionCount++;
          if (rejectionCount === promises.length) {
            reject(new AggregateError('All promises were rejected'));
          }
        });
      });
    });
  };

  try {
    const fetchPromises = urls.map(url => fetchWithRetry(url));
    const result = await raceToSuccess(fetchPromises);
    // 取消其他正在进行的请求
    fetchPromises.forEach(p => p.catch(() => {}));
    return result;
  } catch (error) {
    ctx.logger.error('所有请求都失败了，可能是服务器出问题了？', error);
    return null;
  }
}

async function addplayer(ctx: Context, { session }) {
  await sendMessage(session, '请输入要添加的玩家id');
  const input = await session.prompt(20000);

  if (input && input.trim().length !== 0) {
    await ctx.database.create("ddnetfriendsdata", { userid: session.userId, playername: input.trim() });
    await sendMessage(session, '添加成功,玩家id: ' + input.trim());
  } else {
    await sendMessage(session, '添加失败: 未输入玩家id或输入超时');
  }
}


async function deleteplayer(ctx: Context, { session }) {
  const existingPlayers = await ctx.database.get("ddnetfriendsdata", { 
    userid: session.userId
  });

  const validPlayers = existingPlayers.filter(player => player.playername !== '');
  
  if (validPlayers.length > 0) {
    const playerList = validPlayers.map((player, index) => `${index + 1}.${player.playername}`).join('\n');
    await sendMessage(session,`当前玩家列表：\n${playerList}\n\n请输入要删除的玩家序号：`);
    
    const input = await session.prompt(20000);
    const index = parseInt(input) - 1;
    
    if (isNaN(index) || index < 0 || index >= validPlayers.length) {
      await sendMessage(session,'无效的输入，删除取消');
      return;
    }
    
    const playerToDelete = validPlayers[index];
    await ctx.database.remove("ddnetfriendsdata", { 
      userid: session.userId, 
      playername: playerToDelete.playername 
    });
    await sendMessage(session,'删除成功，玩家: ' + playerToDelete.playername);
    return;
  } else {
    return;

  }
}



async function getpoints(ctx: Context,{ session },target) {
  const pointsurl='https://ddnet.org/players/?json2=';
  let playernamelist;
 try{
  if (target !==null){
    playernamelist =[{playername:target}];
  }
  else{
    playernamelist = await ctx.database.get('ddnetfriendsdata', {
      userid: session.userId,
      playername: { $ne: '' }  // 添加这个条件来确保 playername 不为空
    }, ['playername']);
    
  }
  


  // 添加返回内容为空的提示
  if (playernamelist.length === 0) {
    
    await sendMessage(session,'未找到匹配的玩家id,是否要添加');
    const input = await session.prompt(20000);
      if (input && input.length !==0)
      {
        await ctx.database.create("ddnetfriendsdata", {userid:session.userId, playername: input});
        await sendMessage(session,'添加成功,玩家id:'+input);
        return;
      }
      else{
        return;
      }
    
  }
  else if(playernamelist.length > 1){//返回玩家数量大于1的情况

    const newPlayerArray = playernamelist.map(player => player.playername);
    const formattedPlayerNames = newPlayerArray.map((name, index) => 
      `${index + 1}.${name}`
    ).join('\n');
    await sendMessage(session, '请输入要查询玩家的序号:\n' + formattedPlayerNames);
    const input = await session.prompt(20000);
    
    if (input && input.length !== 0) {
      const inputNumber = parseInt(input);
      if (isNaN(inputNumber) || inputNumber < 1 || inputNumber > playernamelist.length) {
        await sendMessage(session, '无效输入。请输入一个有效的序号。');
        return;
      }
    
      try {
        const fetchPromises = await ctx.http.get(pointsurl + playernamelist[input-1].playername, { responseType: 'json' });
    
        if (fetchPromises && fetchPromises.player && fetchPromises.points) {
          const playerName = fetchPromises.player;
          const playerPoints = fetchPromises.points.points;
          const playerRank = fetchPromises.points.rank;
          await sendMessage(session, `${playerName}: ${playerPoints} 排名: ${playerRank}`);
        } else {
          await sendMessage(session, '没有查到这个玩家，看一下是不是输错id了吧');
        }
      } catch (error) {
        ctx.logger.error('获取玩家数据时出错:', error);
        await sendMessage(session, '获取玩家数据时出错，请稍后再试。');
      }
    } else {
      return;
    }


  }
  else { // 返回玩家数量1情况
    try {
      const fetchPromises = await ctx.http.get(pointsurl + playernamelist[0].playername, { responseType: 'json' });
      
      if (fetchPromises && fetchPromises.player && fetchPromises.points) {
        const playerName = fetchPromises.player;
        const playerPoints = fetchPromises.points.points;
        const playerRank = fetchPromises.points.rank;
        await sendMessage(session, `${playerName}: ${playerPoints} 排名: ${playerRank}`);
      } else {
        await sendMessage(session, '没有查到这个玩家,看一下是不是输错id了吧');
      }
    } catch (error) {
      ctx.logger.error('获取数据时发生错误:', error);
      await sendMessage(session, '获取数据时发生错误,请稍后再试。');
    }
  }
 }catch(error){
  await sendMessage(session,'网络似乎开了会儿小差'+error);
  return;
 }

}


async function extractNames(input) {
  // 使用正则表达式匹配所有的名字
  const regex = /add_friend\s+"([^"]+)"/g;
  const matches = input.match(regex);
  
  // 从匹配结果中提取名字并存入数组
  const names = matches.map(match => {
    return match.replace(/add_friend\s+"/, '').replace(/"$/, '');
  });
  
  // 将数组转换为逗号分隔的字符串
  return names.join(',');
  
}

//添加好友
async function addlist(ctx: Context, arrfriends) {
  for (let friend of arrfriends) {
    // 首先检查数据库中是否已存在相同的 userid 和 friendname
    const existingRecord = await ctx.database.get('ddnetfriendsdata', {
      userid: friend.userid,
      friendname: friend.friendname
    });

    // 如果不存在相同记录，则创建新记录
    if (!existingRecord || existingRecord.length === 0) {
      await ctx.database.create('ddnetfriendsdata', {
        userid: friend.userid,
        friendname: friend.friendname
      });
    }
    // 如果存在相同记录，则跳过（不做任何操作）
  }
}


var backlist
//获取列表
async function getlist(ctx: Context, qqid) {  

  const backlist =await ctx.database.get('ddnetfriendsdata', {userid: [qqid],},['friendname','Special_Attention'])
  return backlist;
}




//删除好友
async function deletefriend(ctx: Context, userid,friendname) {
  for (let friend of friendname) {
  const backlist = await ctx.database.remove("ddnetfriendsdata", { userid: friend.userid, friendname: friend.friendname});
  return backlist.matched;
  }
}


//删除全部好友
async function deleteallfriend(ctx, userid) {
  try {
    await ctx.database.remove("ddnetfriendsdata", { userid: userid });
    return '已全部完成';
  } catch (error) {
    ctx.logger.error('删除好友失败: ' + error.message);
    throw new Error('删除好友失败');
  }
}

//编辑网页内容
async function getimage(nickname1,warband,emoji){

  let newcolorbody;
  let colorbody;
  let special_attention_css=''

    const processColorBody = (colorBody) => {
        if (colorBody === 'null' || colorBody === undefined) {
            return null;
        }

        // 将颜色转换为16进制并补足为6位
        let hex = parseInt(colorBody).toString(16).padStart(6, '0');

        // 拆分 hex 字符串为 h、s 和 l，每两位进行转换
        let h = parseInt(hex.substring(0, 2), 16); // 取前两位
        let s = parseInt(hex.substring(2, 4), 16); // 取中间两位
        let l = parseInt(hex.substring(4, 6), 16); // 取后两位

        // 将 h 从 0-255 映射到 0-360
        h = Math.round((h / 255) * 360);
        // 将 s 从 0-255 映射到 0-100
        s = Math.round((s / 255) * 100);
        // 将 l 从 0-255 映射到 50-100
        l = Math.round((l / 255) * (100 - 50) + 50);


        // 返回 h, s, l
        return { h, s, l };
    };

    colorbody = nickname1.map(friend => {
        const color = processColorBody(friend.color_body);
        if (color === null) {
            return 'null';
        }
        return `${color.h},${color.s},${color.l}`; // 返回 h, s, l
    });

    newcolorbody = JSON.stringify(colorbody);

  
//获取颜色end
  let emojistring;
  if (emoji ==true){
    emojistring='font-family: \'Font\', seguiemj;'
  }
  else
  {
    emojistring='';
  }
  let canvas = [];
  Object.keys(nickname1).forEach(index => {
    canvas.push(`'canvas${parseInt(index)}'`); // 将字符串转换为整数并加 1
  });
  const canvasnew = canvas.join(', ');
  
  let div='';
  //const imageurl = nickname1.map(item => `'https://ddnet.org/skins/skin/community/${item.skin}.png'`);
  const skinDir = path.join(__dirname, '..', 'skin');

  // 确保skin目录存在
  try {
    await fsPromises.access(skinDir, fs.constants.F_OK);
  } catch (error) {
    await fsPromises.mkdir(skinDir, { recursive: true });
  }

  // 从官网获取默认皮肤
  const getDefaultSkin = async () => {
    const defaultSkinUrl = 'https://ddnet.org/skins/skin/community/default.png';
    const defaultImagePath = path.join(skinDir, 'default.png');
    try {
      const response = await fetch(defaultSkinUrl);
      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        await fsPromises.writeFile(defaultImagePath, buffer);
        console.log('Default skin fetched from DDNet and cached.');
        return buffer;
      } else {
        throw new Error('Failed to fetch default skin from DDNet');
      }
    } catch (error) {
      console.error('Error fetching default skin:', error);
      throw error;
    }
  };

  const imageurl = await Promise.all(nickname1.map(async item => {
    const skinName = item.skin;
    const localSkinPath = path.join(skinDir, `${skinName}.png`);
    const ddnetSkinUrl = `https://ddnet.org/skins/skin/community/${skinName}.png`;
    
    try {
      // 检查本地skin目录是否存在对应图片
      await fsPromises.access(localSkinPath, fs.constants.F_OK);
      const imageBuffer = await fsPromises.readFile(localSkinPath);
      const base64Image = imageBuffer.toString('base64');
      return `'data:image/png;base64,${base64Image}'`;
    } catch (error) {
      // 本地不存在,尝试从官网获取并缓存
      try {
        const response = await fetch(ddnetSkinUrl);
        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          await fsPromises.writeFile(localSkinPath, buffer);
          const base64Image = buffer.toString('base64');
          return `'data:image/png;base64,${base64Image}'`;
        } else {
          throw new Error('Skin not found on ddnet');
        }
      } catch (error) {
        //console.error(`Failed to fetch skin ${skinName}, using default.png`);
        try {
          const defaultImageBuffer = await fsPromises.readFile(path.join(skinDir, 'default.png'));
          const base64Image = defaultImageBuffer.toString('base64');
          return `'data:image/png;base64,${base64Image}'`;
        } catch (defaultError) {
          console.error('Default skin not found, fetching from DDNet.');
          const defaultImageBuffer = await getDefaultSkin();
          const base64Image = defaultImageBuffer.toString('base64');
          return `'data:image/png;base64,${base64Image}'`;
        }
      }
    }
  }));

//console.log(imageurl)
  
  //console.log(imageurl)
  for (let key in nickname1) {
    if (nickname1.hasOwnProperty(key)) {
      if (warband === true && nickname1[key].warband && nickname1[key].warband !== 'null') {
        nickname1[key].warband = ` - [${nickname1[key].warband}]`;
      } else {
        nickname1[key].warband = '';
      }
      if (nickname1[key].afk =='true'){
        nickname1[key].afk='afk';
      }
      else{
        nickname1[key].afk='';
      }
      
      if (nickname1[key].Special_Attention ==''){
        special_attention_css=''
      }
      else{
        special_attention_css='special_attention_css'
        if (nickname1[key].afk =='afk'){
          special_attention_css='special_attention_css_afk'
        }
      }
        div += `<div class="user-list">
                        <div class="user-item ${nickname1[key].afk} ${special_attention_css}">
                            <canvas class="my-canvas" style="width: 96px; height: 64px" id=canvas`+[key]+`></canvas>
                            <div class="user-info">
                                <p class="user-name">${nickname1[key].friendname}<span class="warband">${nickname1[key].warband}</span></p>
                                <p class="user-details">服务器:${nickname1[key].servername}</p>
                                <p class="user-details">地图名:${nickname1[key].mapname}</p>
                            </div>
                        </div>
                  </div>`;
    }

}


const colorBodyArray = nickname1.map(item => item.color_body);

  const htmlContent =`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
    <style>
        @font-face {
        font-family: 'Font';
        src: url(data:font/truetype;charset=utf-8;base64,${fontBase64}) format('truetype');
        font-weight: normal;
        font-style: normal;
      }


        body {
            ${emojistring}
            background-color: #2c2c2c;
            padding: 0px;
            width:300px;
            resize: both;
        }
        .user-list {
            width: 300px;
            margin: 0 ;
        }
        .user-item {
            display: flex;
            align-items: center;
            background-color: #4c8c4f;
            margin-bottom: 5px;
            padding: 10px;
            border-radius: 5px;
        }
        .user-avatar {
            width: 30px;
            height: 30px;
            border-radius: 50%;
            margin-right: 10px;
        }
        .user-info {
            flex-grow: 1;
        }
        .user-name {
            color: #ffffff;
            font-weight: bold;
            margin: 0;
        }
        .user-details {
            color: #f4f4f4;
            font-size: 0.8em;
            margin: 0;
        }
        .afk{
        background-color: #998500;
        }
        .special_attention_css{
        background-color: #ff8caa;
        }
        .special_attention_css_afk{
        background: linear-gradient(to right, #ff8caa, #998500);

        }
    </style>
</head>
<body>`+div+`

<script>
window.onload = function() {
    var canvasIds = [`+canvasnew+`];
    var canvases = canvasIds.map(function(id) { return document.getElementById(id); });
    var contexts = canvases.map(function(canvas) { return canvas.getContext('2d'); });

    // 图像源
    var images = [
`+imageurl+`
    ];
    
    var colorbody = ${newcolorbody};

    // 创建一个加载图像的 Promise 数组
    var imagePromises = images.map(function(src, index) { return loadImage(src, index); });

    // 使用 Promise.all 等待所有图像加载完成
    Promise.all(imagePromises)
        .then(function() {
            console.log('All images loaded successfully');
        })
        .catch(function(error) {
            console.error('Error loading images:', error);
        });

function loadImage(src, index) {
    return new Promise(function(resolve, reject) {
        var img = new Image();
        img.crossOrigin = "Anonymous";  // 设置在 src 之前
        img.onerror = function() {
            // 如果主要链接加载失败，尝试使用备用链接
            if (img.src !== 'https://ddnet.org/skins/skin/default.png') {
                console.log('Image load failed. Trying backup URL.');
                img.src = 'https://ddnet.org/skins/skin/default.png';
            } else {
                reject('Both primary and backup image URLs failed to load.');
            }
        };
            img.onload = function() {
                var s = 1;

                // 为每个画布绘制相应的图像
                var canvas = canvases[index];
                var context = contexts[index];
                canvas.width = 96 * s;
                canvas.height = 64 * s;

                // 处理图像颜色
                var processedImg = processImageColor(img, colorbody[index]);
                
                drawImages(context, processedImg, s);
                resolve();
            };
            img.src = src;
        });
    }

    // 处理图像颜色的函数
function processImageColor(img, color, brightnessFactor = 0.7) {
    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext('2d');
    canvas.width = img.width;
    canvas.height = img.height;

    // 绘制原始图像
    ctx.drawImage(img, 0, 0);

    // 如果颜色不是 'null'，进行处理
if (color !== 'null') {
    var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    var data = imageData.data;
    var hsl = color.split(',').map((value, index) => {
        if (index === 0) {
            return parseInt(value);
        } else {
            return parseFloat(value.replace('%', '')) / 100;
        }
    });

    function hslToRgb(h, s, l) {
        var r, g, b;

        if (s == 0) {
            r = g = b = l; // achromatic
        } else {
            var hue2rgb = function hue2rgb(p, q, t) {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1/6) return p + (q - p) * 6 * t;
                if (t < 1/2) return q;
                if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
                return p;
            }

            var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            var p = 2 * l - q;
            r = hue2rgb(p, q, h / 360 + 1/3);
            g = hue2rgb(p, q, h / 360);
            b = hue2rgb(p, q, h / 360 - 1/3);
        }

        return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
    }

    var rgb = hslToRgb(hsl[0], hsl[1], hsl[2]);

    
    var brightnessAdjustment = 0.83; // 亮度调整

    for (var i = 0; i < data.length; i += 4) {
        var avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
        // 使用原始亮度调整新颜色，并应用亮度因子和额外的亮度调整
        data[i] = Math.min(255, (rgb[0] * avg * brightnessFactor * brightnessAdjustment) / 150);
        data[i + 1] = Math.min(255, (rgb[1] * avg * brightnessFactor * brightnessAdjustment) / 150);
        data[i + 2] = Math.min(255, (rgb[2] * avg * brightnessFactor * brightnessAdjustment) / 150);
        // 保持原始的 alpha 值
    }

    ctx.putImageData(imageData, 0, 0);
}

    return canvas;
}

    // 绘制图像的函数
    function drawImages(ctx, img, s) {
        // 开始渲染
        ctx.drawImage(img, 192 * s, 64 * s, 64 * s, 32 * s, 8 * s, 32 * s, 64 * s, 30 * s); // back feet shadow
        ctx.drawImage(img, 96 * s, 0 * s, 96 * s, 96 * s, 16 * s, 0 * s, 64 * s, 64 * s); // body shadow
        ctx.drawImage(img, 192 * s, 64 * s, 64 * s, 32 * s, 24 * s, 32 * s, 64 * s, 30 * s); // front feet shadow
        ctx.drawImage(img, 192 * s, 32 * s, 64 * s, 32 * s, 8 * s, 32 * s, 64 * s, 30 * s); // back feet
        ctx.drawImage(img, 0 * s, 0 * s, 96 * s, 96 * s, 16 * s, 0 * s, 64 * s, 64 * s); // body
        ctx.drawImage(img, 192 * s, 32 * s, 64 * s, 32 * s, 24 * s, 32 * s, 64 * s, 30 * s); // front feet
        ctx.drawImage(img, 64 * s, 96 * s, 32 * s, 32 * s, 39 * s, 18 * s, 26 * s, 26 * s); // left eye

        // right eye (flip and draw)
        ctx.save();
        ctx.scale(-1, 1);
        ctx.drawImage(img, 64 * s, 96 * s, 32 * s, 32 * s, -73 * s, 18 * s, 26 * s, 26 * s);
        ctx.restore();
    }

    // 获取所有 .user-item 元素
    var userLists = document.querySelectorAll('.user-item');
    // 计算 body 的高度
    var bodyHeight = userLists.length * 89; // 每个 .user-item 高度为 89px
};
</script>
</body>
</html>`




return htmlContent;
}



function updateserverinfo(htmldata)
{
  if (typeof htmldata === 'object' && htmldata !== null) {
    const dataArray = Object.values(htmldata)[0];
  
    if (Array.isArray(dataArray)) {
      let flattenedData = [];
  
      try {
        flattenedData = dataArray.flatMap(item => {
          const servername = item.info.name;
          const mapname = item.info.map.name;
  
          if (item.info.clients.length === 0) {
            return [`friendname:null,skinname:null,servername:${servername},mapname:${mapname}`];
          }
  
          return item.info.clients.map(client => 
            `friendname:${client.name || 'null'},skinname:${client.skin?.name || 'null'},servername:${servername},mapname:${mapname},color_body:${client.skin?.color_body || 'null'},color_feet:${client.skin?.color_feet || 'null'},warband:${client.clan},afk:${client.afk}`
          );
        });
        //console.log(flattenedData)
        return flattenedData;
      } catch (error) {
        console.error('Error processing data:', error);
        console.log('Raw dataArray:', JSON.stringify(dataArray, null, 2));
      }
    } 
  } 
}

function checkAndPrintFriendsnew(newclientInfoArray, backlist) {

  const backlistMap = new Map(backlist.map(item => [item.friendname, item.Special_Attention]));

  const formattedIntersection = newclientInfoArray
    .map(item => {
      const parts = item.split(',');
      const friendnamePart = parts.shift();
      const friendname = friendnamePart.slice(friendnamePart.indexOf(':') + 1);
      
      if (!friendname || !backlistMap.has(friendname)) {
        return null;
      }
      return {
        friendname,
        skin: parts[0].split(':')[1],
        servername: parts[1].split(':')[1],
        mapname: parts[2].split(':')[1],
        color_body: parts[3].split(':')[1],
        color_feet: parts[4].split(':')[1],
        warband: parts[5].split(':')[1],
        afk: parts[6].split(':')[1],
        Special_Attention: backlistMap.get(friendname)
      };
    })
    .filter(Boolean);

  return formattedIntersection;
}

export async function apply(ctx: Context,Config,session) {
  
  //获取配置信息
const config =ctx.config;

// 初始化时更新群组数据
ctx.on('ready', async () => {
  const bots = ctx.bots
  try {
    for (const bot of bots) {
      for await (const guild of bot.getGuildIter()) {
        for await (const member of bot.getGuildMemberIter(guild.id)) {
          try {
            await ctx.database.upsert('ddnet_group_data', [{
              user_id: member.user.id  // 只使用 user 对象的 id 属性
            }], ['user_id'])
          } catch (error) {
            console.error(`数据库操作失败: ${error.message}`)
          }
        }
      }
    }
    //console.log('群组数据初始化完成')
  } catch (error) {
    ctx.logger(`群组数据初始化失败: ${error.message}`)
  }
})

// 监听成员加入事件
ctx.on('guild-member-added', async (session) => {
  await ctx.database.upsert('ddnet_group_data', [{
    user_id: session.userId
  }], ['user_id'])
  console.log(`新成员加入：${session.username}`)
})

// 监听成员退出事件
ctx.on('guild-member-removed', async (session) => {
  await ctx.database.remove('ddnet_group_data', {
    user_id: session.userId
  })
  console.log(`成员退出：${session.username}`)
})

ctx.model.extend('ddnetfriendsdata', {
  // 各字段的类型声明
  id: 'unsigned',
  userid: 'string',
  friendname: 'string',
  playername: 'string',
  Special_Attention: 'string'
}, {
  primary: 'id',
  autoInc: true,
})

ctx.model.extend('ddnet_group_data', {
  id: 'unsigned',
  user_id: 'string',
  last_sent_time: 'string',
  friendname: 'string'
}, {
  primary: 'id',
  autoInc: true,
})

let allfriends,newclientInfoArray,special_attention_newclientInfoArray;


//获取关注列表
async function get_Special_Attention(ctx: Context) {  

  const backlist =await ctx.database.get('ddnetfriendsdata', {Special_Attention: 'yes',},['userid','friendname'])

  //console.log(backlist);
  return backlist;
}
//查询关注列表
function findMatchingFriendnames(special_attention_newclientInfoArray, backlist) {
  const Special_Attention_online = [];

  special_attention_newclientInfoArray.forEach(clientInfo => {
    const friendnameMatch = clientInfo.match(/friendname:([^,]+)/);
    if (friendnameMatch) {
      const friendname = friendnameMatch[1];
      if (friendname !== 'null') {
        const backlistEntry = backlist.find(entry => entry && entry.friendname === friendname);
        if (backlistEntry) {
          const userid = backlistEntry.userid || 'unknown';
          Special_Attention_online.push(`friendname:${friendname},userid:${userid}`);
        }
      }
    }
  });

  return Special_Attention_online;
}



if (ctx.config.Special_Attention ===true){
  

  // 创建一个 Map 来存储 friendname 的最后发送时间
  ctx.setInterval(async () => {
    try {
      const special_attention_htmldata = await ddlist(ctx);
      special_attention_newclientInfoArray = await updateserverinfo(special_attention_htmldata);
      const Special_Attention = await get_Special_Attention(ctx);
      const Special_Attention_online = await findMatchingFriendnames(special_attention_newclientInfoArray, Special_Attention);
  
      // 获取所有群组数据
      const groupData = await ctx.database.get('ddnet_group_data', {});
  
      // 创建一个 Set 来跟踪已经发送消息的用户 ID 和 friendname 组合
      const sentCombinations = new Set();
  
      // 获取当前本地时间
      const now = new Date();
      // 处理 Special_Attention_online 中的每个项目
      for (const item of Special_Attention_online) {
        const firstColonIndex = item.indexOf(':');
        const lastCommaIndex = item.lastIndexOf(',');
        
        // 提取完整的 friendname，包括可能存在的冒号
        const friendname = item.slice(firstColonIndex + 1, lastCommaIndex);
        const ddnetUserId = item.slice(lastCommaIndex + 1).split(':')[1];
  
        // 检查该用户 ID 和 friendname 的组合是否存在
        const existingRecord = groupData.find(data => data.user_id === ddnetUserId && data.friendname === friendname);
  
        if (existingRecord) {
          // 如果记录存在，检查是否需要发送消息
          let lastSentTime;
          if (existingRecord.last_sent_time) {
            // 处理旧的时间格式
            lastSentTime = new Date(existingRecord.last_sent_time);
            if (isNaN(lastSentTime.getTime())) {
              // 如果是无效日期，尝试解析为本地时间
              lastSentTime = new Date(existingRecord.last_sent_time.replace(' ', 'T') + 'Z');
            }
          } else {
            lastSentTime = new Date(0);
          }
  
          if (now.getTime() - lastSentTime.getTime() < ctx.config.Special_Attention_Interval_time * 60 * 60 * 1000) {
            continue; // 如果在指定时间内发送过，跳过这个组合
          }
        }
  
        // 如果这个组合还没有发送过消息
        if (!sentCombinations.has(`${ddnetUserId}-${friendname}`)) {
          try {
            await ctx.bots[0].sendPrivateMessage(ddnetUserId, `你关注的好友 ${friendname} 偷偷上线了`);
  
            sentCombinations.add(`${ddnetUserId}-${friendname}`);
  
            // 更新或创建数据库记录
            const newLastSentTime = now.toISOString();
            if (existingRecord) {
              // 更新现有记录
              await ctx.database.set('ddnet_group_data', { user_id: ddnetUserId, friendname: friendname }, {
                last_sent_time: newLastSentTime
              });
            } else {
              // 创建新记录
              await ctx.database.create('ddnet_group_data', {
                user_id: ddnetUserId,
                friendname: friendname,
                last_sent_time: newLastSentTime
              });
            }
          } catch (sendError) {
            ctx.logger.error('发送消息时发生错误：', sendError);
          }
        }
      }
  
      // 清理数据库中超过指定时间的记录
      const cleanupTime = new Date(now.getTime() - (ctx.config.Special_Attention_Interval_time * 60 * 60 * 1000));
      await ctx.database.remove('ddnet_group_data', { last_sent_time: { $lt: cleanupTime.toISOString() } });
  
    } catch (error) {
      ctx.logger.error('发生错误：', error);
      ctx.logger.error('错误堆栈：', error.stack);
      ctx.logger.error('发生错误，请检查日志。');
    }
  }, ctx.config.Special_Attention_listening * 60 * 1000);

}


  // write your plugin here


  
  const SCREENSHOT_WIDTH = 315;
  const NETWORK_IDLE_TIMEOUT = 5000;
  const SCREENSHOT_PADDING = 15;
  
  ctx.command('dd在线', '输入‘帮助 dd在线’查看其他命令')
    .action(async ({ session }) => {
      try {
        const qqid = session.userId;
        const [htmldata, backlist] = await Promise.all([
          ddlist(ctx),
          getlist(ctx, qqid)
        ]);
  
        if (backlist.length === 0) {
          await sendMessage(session, '未找到相关数据,你似乎还没有导入好友列表');
          return;
        }
        const newclientInfoArray = updateserverinfo(htmldata);
        const allfriends = checkAndPrintFriendsnew(newclientInfoArray, backlist);
        
        if (allfriends.length === 0) {
          await sendMessage(session, '无在线好友');
          return;
        }
  
        if (Config?.useimage === true) {
          await handleImageOutput(ctx, session, allfriends, ctx.puppeteer.browser, Config);
        } else {
          await handleTextOutput(session, allfriends);
        }
      } catch (error) {
        ctx.logger.error('Error during operation:', error);
        await sendMessage(session, '操作过程中发生错误，请稍后再试');
      }
    });
  
  async function handleImageOutput(ctx, session, allfriends, browser, config) {
    let context, page;
    try {
      const { enablewarband, enableemoji } = config;
      const gethtml = await getimage(allfriends, enablewarband, enableemoji);
  
      context = await browser.createBrowserContext();
      page = await context.newPage();
  
      await page.setContent(gethtml);
      await Promise.race([
        page.waitForNetworkIdle({ idleTime: 500, timeout: NETWORK_IDLE_TIMEOUT }),
        new Promise(resolve => setTimeout(resolve, NETWORK_IDLE_TIMEOUT))
      ]);
  
      const bodyHeight = await page.evaluate(() => document.body.scrollHeight);
      const clip = { x: 0, y: 0, width: SCREENSHOT_WIDTH, height: bodyHeight + SCREENSHOT_PADDING };
  
      const image = await page.screenshot({ clip });
      await sendMessage(session, h.image(image, 'image/png'));
    } catch (error) {
      ctx.logger.error('Error in handleImageOutput:', error);
      await sendMessage(session, '生成图片时发生错误，请稍后再试');
    } finally {
      if (page) await page.close().catch(e => ctx.logger.error('Failed to close page:', e));
      if (context) await context.close().catch(e => ctx.logger.error('Failed to close context:', e));
    }
  }
  
  async function handleTextOutput(session, allfriends) {
    const resultString = allfriends.map(friend => `${friend.friendname}\n`).join('');
    await sendMessage(session, h('at', { id: session.userId }) + '你的在线好友:\n' + resultString);
  }
  



//--------------------------------------------------------------------------------------------------------------------------------------------------------------



ctx.command('dd在线').subcommand('dd删除好友')
.action(async ({session}) => {
  const userid = session.userId;  // 定义用户 ID
  
  try {
    await sendMessage(session, '输入好友列表，如 123,234,abc,支持单个或批量');
    const content = await session.prompt(15000);
    
    if (!content) {
      await sendMessage(session, '操作超时，已取消。');
      return;
    }
    
    // 将中文逗号替换为英文逗号，然后分割字符串
    const friendNames = content.replace(/，/g, ',').split(',').map(name => name.trim());
    
    // 移除空字符串
    const validFriendNames = friendNames.filter(name => name !== '');
    
    if (validFriendNames.length === 0) {
      await sendMessage(session, '未输入有效的好友名称，操作已取消。');
      return;
    }

    // 使用 map 方法生成对象数组
    const arrfriends = friendNames.map(friendName => {
      return { 'userid': userid, 'friendname': friendName };
    });

    const deletesum = await deletefriend(ctx, userid, arrfriends);
    if (deletesum !== 0) {  
      await sendMessage(session,'已删除' + deletesum + '个好友');
      return;
    } else { 
      await sendMessage(session,'删除' + deletesum + '个好友，似乎没有找到匹配项');
      return;
    }
  } catch (error) {
    await sendMessage(session,'发生错误：' + error.message);
    return;
  }
});


//--------------------------------------------------------------------------------------------------------------------------------------------------------------
ctx.command('dd在线').subcommand('dd删除全部好友')
 
.action(async ({session}) => {
  const userid = session.userId;
  await sendMessage(session,await deleteallfriend(ctx, userid));
  return;
})

//--------------------------------------------------------------------------------------------------------------------------------------------------------------



ctx.command('dd在线').subcommand('dd添加好友')
  .action(async ({ session }) => {
    await sendMessage(session,'请在游戏中点击皮肤目录,并返回上一级菜单,双击settings_ddnet.cfg,用笔记本或记事本打开,复制里面所有的内容粘贴过来(如果只添加单个好友请直接输入好友名)\n输入:取消\n可以取消输入');
    let content = await session.prompt();

    if (content === '取消' || content === null) {
      await sendMessage(session,'已取消输入');
      return;
    }

    // 新增的处理逻辑
    if (!content.includes('add_friend') && content.length <= 30) {
      content = `add_friend "${content}" ""`;
    }

    const userid = session.userId;
    const str = await extractNames(content);
    const friendNames = str.split(',');

    // 修改这里，将 content 作为单独的数组
    const arrfriends = [{ 
      userid: userid,
      friendname: content 
    }];

    // 如果内容包含 'add_friend'，则使用原来的处理逻辑
    if (content.includes('add_friend')) {
      arrfriends.pop(); // 移除之前添加的单独数组元素
      friendNames.forEach(friendName => {
        arrfriends.push({
          userid: userid,
          friendname: friendName
        });
      });
    }

    await addlist(ctx, arrfriends);
    await sendMessage(session,'添加成功');
    return;
  });


//--------------------------------------------------------------------------------------------------------------------------------------------------------------




//查分\添加玩家id
ctx.command('dd在线').subcommand('添加玩家')
.action(async ({ session }) => {
await addplayer(ctx,{session})
return;
});


ctx.command('dd在线').subcommand('points [...args:string]')
  .alias('查分')
  .action(async ({ session, args }) => {
    if (args.length > 0) {
      // 如果有追加内容，进行相应处理
      const target = args.join(' ');
      await getpoints(ctx, { session },target);
    } else {
      // 如果没有追加内容，执行原来的逻辑
      const target=null
      await getpoints(ctx, { session },target);
    }
  });



//未完成地图
ctx.command('dd在线').subcommand('地图情况 [...args:string]')
  .action(async ({ session,args }) => {
    if (args.length > 0) {
    await sendMessage(session,'请输入要查询的序列号\n1.简单图(Novice)\n2.中阶图(Moderate)\n3.高阶图(Brutal)\n4.疯狂图(Insane)\n5.传统图(Oldschool)\n6.古典图(DDmaX)\n7.分身图(Dummy)\n8.单人图(Solo)\n9.竞速图(Race)');
    const select = await session.prompt(10000);
    if (!select)return;
    else fetchPlayerData(ctx,args,select,session);
    }
    else
    {
      await sendMessage(session,'未输入玩家ID,请重新输入\n如 地图情况 我的ID');
      return;
    }
  });

ctx.command('dd在线').subcommand('删除玩家')
.action(async ({ session }) => {
await deleteplayer(ctx,{session})
return;
});



ctx.command('dd在线').subcommand('关注 [...args:string]')
.action(async ({ session, args }) => {
  if (args.length > 0) {
    let special_sttention = args;
    let userid = session.userId;
    return await updateSpecialAttention(ctx,userid, special_sttention,session);
    
  } else {
    await sendMessage(session,'未输入玩家ID，请重新输入\n如 关注 我的ID');
    return ;
  }
});

ctx.command('dd在线').subcommand('取消关注 [...args:string]')
.action(async ({ session, args }) => {
  if (args.length > 0) {
    let special_sttention = args;
    let userid = session.userId;
    return await cancelSpecialAttention(ctx,userid, special_sttention,session);
  } else {
    await sendMessage(session,'未输入玩家ID，请重新输入\n如 取消关注 我的ID');
    return;
  }
});



}