# 一个用于查询你ddnet好友是否在线的插件


可用指令:
### **dd添加好友(用于添加好友,批量添加的方法:在游戏设置中点开tee,右下角有个皮肤目录,点击后弹出资源管理器,返回上一级,目录中有一个settings_ddnet.cfg,复制里面的所有内容)**

关注(痴汉行为)

地图情况(目前仅用于查询未完成地图)

添加玩家(用于查分的id)

删除玩家(删除查分id)

points(查分,如果只添加一个玩家默认就是返回这个玩家的)

dd在线(查询好友在线状态)

dd删除全部好友

dd删除好友(格式:name1,name2,name3,.....)

ps:孩子实在吃不起饭了,如果觉得用的还不错的话可以请作者喝杯奶茶吗,十分感谢你的赞助！

![QR code.png](https://github.com/yezi8430/koishi-plugin-ddnetfriends/blob/master/QR%20code.png)

更新日志

v1.0.1:默认开启皮肤颜色

**v1.0.0:校正了皮肤颜色算法,现在终于跟游戏中的效果基本一致了;修复一个bug,获取列表时查询不到名字中带冒号的ID**

v0.6.2:修复一个可以添加空id的bug

v0.6.0:允许单个好友添加

v0.5.8:现在会将皮肤缓存到skin文件夹中,用于提升加载速度;稍微优化了一下皮肤颜色

v0.5.7:新增发送消息函数,现在支持临时会话(前提是得打开),不需要加bot好友

v0.5.6:现在使用表来存储最后发送关注玩家的时间,避免重新加载插件后重新开始计时。如果更新之后有不生效请重启插件或koishi

v0.5.3:新增删除全部好友

v0.5.0:更新一个‘关注’指令,现在会推送关注用户,如果在线的话会私聊你;小幅度优化字体颜色,更新关注用户的背景颜色,更新关注用户挂机时的背景颜色

v0.4.7:地图情况返回消息改为转发,避免太多未完成导致刷屏的情况

v0.4.5:更新一个地图查询指令:地图情况 玩家id,ps:祝各位dd玩家国庆快乐！

v0.4.4:优化点代码逻辑，调整皮肤颜色

v0.4.2:新加了个皮肤颜色开关,目前效果只能说差强人意(主要在于hsl转rgb比较麻烦),脚的颜色使用的是身体的,毕竟绘制canvas挺麻烦,暂时没弄了

v0.4.1:修改'dd添加好友'的说明

v0.4.0:现在新增一个emoji开关,用来解决emoji表情不显示的问题

v0.3.7:优化添加好友时重复添加数据的问题

v0.3.6:优化EMOJI不显示的问题

v0.3.5:新增一个afk指示器

v0.3.4:修复点小bug

v0.3.3:新增一个显示战队开关，注意该项目以官网返回数据为准，请鉴别是否是玩家本人，可能是别人恰分改的id？

v0.3.2:新增一个逻辑：points或查分可以像游戏中一样支持直接查询，如points 123，查分 123

v0.3.1:修复一个bug,因上个版本添加的指令导致查询dd在线会返回空的内容

v0.3.0:新增指令添加玩家/删除玩家/查分
