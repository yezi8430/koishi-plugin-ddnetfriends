# 一个用于查询你ddnet好友是否在线的插件
目前还在建设中...

可用指令:

添加玩家(用于查分的id)

删除玩家(删除查分id)

points(查分,如果只添加一个玩家默认就是返回这个玩家的)

dd在线(查询好友在线状态)

dd删除好友(格式:name1,name2,name3,.....)

dd添加好友(用于添加好友,批量添加的方法:在游戏设置中点开tee,右下角有个皮肤目录,点击后弹出资源管理器,返回上一级,目录中有一个settings_ddnet.cfg,复制add_friend开头直到最后,假设我这里有5名好友,复制的格式如下)

add_friend "111" "战队1" add_friend "123" "" add_friend "name1" "战队1" add_friend "name2" "" add_friend "name3" "战队1"

更新日志

v0.3.6：优化EMOJI不显示的问题

v0.3.5:新增一个afk指示器

v0.3.4:修复点小bug

v0.3.3：新增一个显示战队开关，注意该项目以官网返回数据为准，请鉴别是否是玩家本人，可能是别人恰分改的id？

v0.3.2：新增一个逻辑：points或查分可以像游戏中一样支持直接查询，如points 123，查分 123

v0.3.1：修复一个bug,因上个版本添加的指令导致查询dd在线会返回空的内容

v0.3.0：新增指令添加玩家/删除玩家/查分