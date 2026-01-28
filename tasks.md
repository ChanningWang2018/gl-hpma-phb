## task1
log中有个错误 Maximum recursive updates exceeded（超过最大递归更新限制）通常意味着你的组件中存在死循环：

触发变化：某个变量（例如 selectedPlants）发生了变化。
触发监听：watch(selectedPlants, ...) 被触发并执行。
再次变化：在 watch 的执行过程中，或者因为 watch 导致的界面重绘，又触发了 selectedPlants 的变化。
无限循环：步骤 2 和 3 不断重复，直到 Vue 强制报错停止。
根据报错堆栈 set value @ ... -> clearAll @ ImageSelector.vue:85 -> ... -> watch，问题很可能出在 ImageSelector 组件与 SalesOptimizer 父组件的交互上：

可能的原因：
ImageSelector 可能在初始化或 props 更新时，频繁地触发 update:modelValue 事件。父组件接收到事件更新 selectedPlants -> 触发 watch -> 界面重绘 -> ImageSelector 又认为需要更新状态 -> 再次触发事件。

解决方法
修改 SalesOptimizer.vue 中的 watch 逻辑，添加一个守卫条件。只有当数组的内容确实发生改变时，才执行后续的重置库存和保存操作。这可以有效阻断“内容没变但引用变了”导致的无限循环。

## task2
去除语言选项与相关的参数

## task3
talent bonus设置成类似blooms rate的下拉框，分别包含10%到60%（一次增加10%）

## task4
solution中显示植物时用图片代替文字，且数量、品质、种类三个信息的位置调整的更紧凑些

# task5
rarecolor的颜色样式要贴合其品质，要接近同品质但不带rarecolor的box的颜色

# very important
代码中不要出现中文注释或中文内容
注重可拓展性、复用性、易维护性、日志清晰