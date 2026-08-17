# 对标飞书项目

RobbFlow V0.2 把飞书项目的三条能力做成一等公民：

1. **自定义工作项类型**：`work_item_type` + `properties` JSONB，字段由表单 schema 描述，而不是一张类型一张表。
2. **自定义流程**：状态、流转存在数据库里，可视化编辑。非法跳转由 Workflow Engine 拒绝。
3. **可视化**：流程图（节点=状态，边=流转）与泳道图（行=负责人/类型/优先级，列=状态）。

再加上企业研发真正要的 **Relation 追溯图** 和 **Sprint / Milestone**。
