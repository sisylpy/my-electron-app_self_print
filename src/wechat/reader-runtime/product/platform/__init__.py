"""平台相关能力：机器指纹 + 访问材料存储。

两个 Driver（Mac / Windows）共用这里的逻辑：
- machine.py   本机稳定指纹（材料只在"取材料的那台机器"上有意义）
- material.py  (machine, account) 二元组绑定的材料存储

这里不做子模块的提前导入，避免 `python -m product.platform.material` 时的
sys.modules 重复加载告警。
"""
