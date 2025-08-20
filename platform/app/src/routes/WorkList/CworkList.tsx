import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import type { DragEndEvent, DragOverEvent, UniqueIdentifier } from '@dnd-kit/core';
import {
	closestCenter,
	DndContext,
	DragOverlay,
	PointerSensor,
	useSensor,
	useSensors
} from '@dnd-kit/core';
import { restrictToHorizontalAxis } from '@dnd-kit/modifiers';
import {
	arrayMove,
	horizontalListSortingStrategy,
	SortableContext,
	useSortable,
} from '@dnd-kit/sortable';
import { Table, Space, Flex, Button, Tabs, message, Input } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { utils, writeFileXLSX } from "xlsx";

interface DragIndexState {
  active: UniqueIdentifier;
  over: UniqueIdentifier | undefined;
  direction?: 'left' | 'right';
}

const DragIndexContext = createContext<DragIndexState>({ active: -1, over: -1 });
const dragActiveStyle = (dragState, id) => {
	const { active, over, direction } = dragState;
	// drag active style
	let style = {};
	if (active && active === id) {
		style = { backgroundColor: 'gray', opacity: 0.5 };
	}
	// dragover dashed style
	else if (over && id === over && active !== over) {
		style =
			direction === 'right'
				? { borderRight: '1px dashed gray' }
				: { borderLeft: '1px dashed gray' };
	}
	return style;
};
const TableBodyCell = props => {
	const dragState = useContext(DragIndexContext);
	return (
		<td
			{...props}
			style={Object.assign(Object.assign({}, props.style), dragActiveStyle(dragState, props.id))}
		/>
	);
};
const TableHeaderCell = props => {
	const dragState = useContext(DragIndexContext);
	const { attributes, listeners, setNodeRef, isDragging } = useSortable({ id: props.id });
	const style = Object.assign(
		Object.assign(
			Object.assign(Object.assign({}, props.style), { cursor: 'move' }),
			isDragging ? { position: 'relative', zIndex: 9999, userSelect: 'none' } : {},
		),
		dragActiveStyle(dragState, props.id),
	);
	return <th {...props} ref={setNodeRef} style={style} {...attributes} {...listeners} />;
};

const BaseTable = (props) => {
	const [data, setData] = useState([])
	const [filterData, setFilterData] = useState([])
	const [loading, setLoading] = useState(false);
	const [messageApi, contextHolder] = message.useMessage();

  const [searchText, setSearchText] = useState('');
  const [searchedColumn, setSearchedColumn] = useState('');
  const searchInput = useRef(null);
  const handleSearch = (selectedKeys, confirm, dataIndex) => {
    confirm();
    setSearchText(selectedKeys[0]);
    setSearchedColumn(dataIndex);
  };
  const handleReset = clearFilters => {
    clearFilters();
    setSearchText('');
  };

  const getColumnSearchProps = dataIndex => ({
    filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters, close }) => (
      <div style={{ padding: 8 }} onKeyDown={e => e.stopPropagation()}>
        <Input
          ref={searchInput}
          placeholder={`Search ${dataIndex}`}
          value={selectedKeys[0]}
          onChange={e => setSelectedKeys(e.target.value ? [e.target.value] : [])}
          onPressEnter={() => handleSearch(selectedKeys, confirm, dataIndex)}
          style={{ marginBottom: 8, display: 'block' }}
        />
        <Space>
          <Button
            type="primary"
            className='bg-primary'
            onClick={() => handleSearch(selectedKeys, confirm, dataIndex)}
            size="small"
            style={{ width: 90 }}
          >
            Search
          </Button>
          <Button
            onClick={() => clearFilters && handleReset(clearFilters)}
            size="small"
            style={{ width: 90 }}
          >
            Reset
          </Button>
          <Button
            type="link"
            size="small"
            onClick={() => {
              close();
            }}
          >
            close
          </Button>
        </Space>
      </div>
    ),
    filterIcon: filtered => <SearchOutlined style={{ color: filtered ? '#1677ff' : undefined }} />,
    onFilter: (value, record) => record[dataIndex].toString().toLowerCase().includes(value.toLowerCase()),
    filterDropdownProps: {
      onOpenChange(open) {
        if (open) {
          setTimeout(() => searchInput.current?.select(), 100);
        }
      },
    },
    render: text => text
  });

	useEffect(() => {
		const fetchData = async () => {
			const response = await fetch(`/api/patients?table=${props.disease}`)
			const { data } = await response.json()
			setData(data.map((item, index) => ({
				...item,
				key: index.toString() // 添加唯一的key
			})))
		}
		fetchData()
	}, [])


	const downloadCSV = () => {
		setLoading(true);
		const worksheet = utils.json_to_sheet(filterData);
		const workbook = utils.book_new();
		utils.book_append_sheet(workbook, worksheet, "Sheet1");
		writeFileXLSX(workbook, "data.xlsx");
		setLoading(false);
	};

  let baseColumns = []
	if (props.disease === 'ovarian_dwi') {
		baseColumns = [
			{ title: '名字', dataIndex: 'name', key: 'name', fixed: 'left', width: 150, ...getColumnSearchProps('pinyin')},
			{ title: '扫描时间', dataIndex: 'scan_date', key: 'scan_date' },
			{ title: '年龄', dataIndex: 'age', key: 'age' },
			{ title: '图像ID', dataIndex: 'image_id', key: 'image_id' },
			{ title: '病人ID', dataIndex: 'patient_id', key: 'patient_id' },
			{
				title: '手术时间', dataIndex: 'surgery_date', key: 'surgery_date', defaultSortOrder: 'descend',
				sorter: (a, b) => {
					const dateA = a.surgery_date ? new Date(a.surgery_date) == 'Invalid Date' ? 1 : new Date(a.surgery_date).getTime() : 1;
					const dateB = b.surgery_date ? new Date(b.surgery_date) == 'Invalid Date' ? 1 : new Date(b.surgery_date).getTime() : 1;
					return dateA - dateB;
				}
			},
			{
				title: '原发灶形态', dataIndex: 'morphology_primary_tumor', key: 'morphology_primary_tumor', width: 200,
				filters: [
					{ text: '肿块型', value: '肿块型' },
					{ text: '小肿块型', value: '小肿块型' },
					{ text: '浸润型', value: '浸润型' },
					{ text: '囊性型', value: '囊性型' }
				], onFilter: (value, record) => record.morphology_primary_tumor.indexOf(value) >= 0
			},
			{ title: '肿块大小', dataIndex: 'mass_size', key: 'mass_size', width: 150 },
			{ title: '肿块质地', dataIndex: 'mass_texture', key: 'mass_texture', width: 150 },
			{
				title: '转移灶形态', dataIndex: 'morphology_metastatic_tumor', key: 'morphology_metastatic_tumor', width: 200,
				filters: [
					{ text: '肿块型', value: '肿块型' },
					{ text: '浸润型', value: '浸润型' },
					{ text: '小肿块型', value: '混合型' }
				], onFilter: (value, record) => record.morphology_metastatic_tumor.indexOf(value) >= 0
			},
			{ title: '化疗周期', dataIndex: 'chemo_cricle', key: 'chemo_cricle', width: 150 },
			{ title: '末次化疗', dataIndex: 'last_date', key: 'last_date', width: 150 },
			{ title: 'PARPi', dataIndex: 'PARPI', key: 'PARPI', width: 100 },
			{ title: '复发情况', dataIndex: 'recurrence', key: 'recurrence', width: 150 },
			{ title: '末次随访时间', dataIndex: 'last_follow_time', key: 'last_follow_time' },
			{ title: '病理', dataIndex: 'pathology', key: 'pathology', width: 150 },
			{
				title: 'FIGO分期', dataIndex: 'figo_stage', key: 'figo_stage',
				filters: [
					{ text: 'II', value: 'II' },
					{ text: 'III', value: 'III' },
					{ text: 'IV', value: 'IV' }
				], onFilter: (value, record) => record.figo_stage.indexOf(value) >= 0
			},
			{
				title: '肿瘤残余', dataIndex: 'residual_disease', key: 'residual_disease', width: 150,
				filters: [
					{ text: 'R0', value: 'R0' },
					{ text: 'R0.5', value: 'R0.5' },
					{ text: 'R1', value: 'R1' },
					{ text: 'R2', value: 'R2' }
				], onFilter: (value, record) => record.residual_disease.indexOf(value) >= 0
			},
			{ title: '残留病灶描述', dataIndex: 'residual_disease_desc', key: 'residual_disease_desc', width: 150 },
			{ title: 'Ki-67', dataIndex: 'KI67', key: 'KI67' },
			{ title: 'CA125', dataIndex: 'CA125', key: 'CA125' },
			{ title: 'HE-4', dataIndex: 'HE4', key: 'HE4' },
			{ title: 'LDH', dataIndex: 'LDH', key: 'LDH' },
			{ title: 'NLR', dataIndex: 'NLR', key: 'NLR' },
			{ title: 'BRCA', dataIndex: 'BRCA', key: 'BRCA' },
			{ title: 'HRD', dataIndex: 'HRD', key: 'HRD' },
			{ title: '病理ID', dataIndex: 'pathology_id', key: 'pathology_id' },
			{ title: '身份证', dataIndex: 'person_id', key: 'person_id', render: () => (<span>******</span>) },
			{ title: '手机', dataIndex: 'phone', key: 'phone' },
			{ title: '电话', dataIndex: 'telephone', key: 'telephone' },
			{ title: '地址', dataIndex: 'address', key: 'address' },
			{ title: '备注', dataIndex: 'comment', key: 'comment', width: 200 },
			{
				title: '操作', dataIndex: 'action', key: 'action', fixed: 'right', render: (value, record) => (
					<Space size="middle">
						<a onClick={async () => {
							try {
								const studies = await props?.dataSource?.query.studies.search({
									offset: 0,
									pageNumber: 1,
									patientName: record.name,
									resultsPerPage: 50,
									storBy: 'studyDate',
									sortDirection: 'ascending'
								})

								if (studies.length) {
									window.open(`/ohif-viewer/viewer?StudyInstanceUIDs=${studies[0].studyInstanceUid}`, '_blank')
								} else {
									messageApi.open({
										type: 'error',
										content: '找不到该病人的图像！',
									});
								}
							} catch (error) {
									messageApi.open({
										type: 'error',
										content: '找不到该病人的图像！',
									});
							}
						}}>查看</a>
						{/* <a onClick={() => {
							const folderPath = `ovarian_dwi/${record.pinyin} ${record.image_id}`
							window.open(`/api/downloaddicom?folder_path=${encodeURIComponent(folderPath)}`, '_blank');
						}}>下载</a> */}
					</Space>
				)
			},
		]
	}
	if (props.disease === 'cervical_mre') {
		baseColumns = [
		{title: '名字', dataIndex: 'name', key: 'name', fixed: 'left', ...getColumnSearchProps('pinyin')},
		{title: '年龄', dataIndex: 'age', key: 'age'},
		{title: '扫描时间', dataIndex: 'scan_date', key: 'scan_date'},
		{title: '图像ID', dataIndex: 'image_id', key: 'image_id'},
		{title: '病人ID', dataIndex: 'patient_id', key: 'patient_id'},
		{title: '是否治疗后检查', dataIndex: 'scan_after_therapy', key: 'scan_after_therapy'},
		{title: '治疗方式', dataIndex: 'therapy_method', key: 'therapy_method'},
		{title: '是否取材类器官', dataIndex: 'chemo_cricle', key: 'chemo_cricle'},
		{title: '病理', dataIndex: 'pathology', key: 'pathology'},
		{title: '大病理', dataIndex: 'pathology_desc', key: 'pathology_desc'},
		{title: '免疫组化', dataIndex: 'IHC', key: 'IHC'},
		{title: '是否生育', dataIndex: 'birth', key: 'birth'},
		{title: '是否绝经', dataIndex: 'menopause', key: 'menopause'},
		{title: '备注', dataIndex: 'comment', key: 'comment'},
		{title: '操作', dataIndex: 'action', key: 'action', fixed: 'right', render: (value, record) => (
			<Space size="middle">
					<a onClick={async () => {
							try {
								const studies = await props?.dataSource?.query.studies.search({
									offset: 0,
									pageNumber: 1,
									patientName: record.name,
									resultsPerPage: 50,
									storBy: 'studyDate',
									sortDirection: 'ascending'
								})

								if (studies.length) {
									window.open(`/ohif-viewer/viewer?StudyInstanceUIDs=${studies[0].studyInstanceUid}`, '_blank')
								} else {
									messageApi.open({
										type: 'error',
										content: '找不到该病人的图像！',
									});
								}
							} catch (error) {
									messageApi.open({
										type: 'error',
										content: '找不到该病人的图像！',
									});
							}
						}}>查看</a>
				{/* <a onClick={()=> {
					let name = record.name.replace(' ', '_')
					const folderPath = `cervical_mre/${name}_${record.image_id}`
					window.open(`/api/downloaddicom?folder_path=${encodeURIComponent(folderPath)}`, '_blank');
				}}>下载</a> */}
		  	</Space>
		)},
	]
	}

	let _a;
	const [dragIndex, setDragIndex] = useState<DragIndexState>({ active: -1, over: -1 });
	const [columns, setColumns] = useState(() =>
		baseColumns.map((column, i) =>
			Object.assign(Object.assign({}, column), {
				key: `${i}`,
				onHeaderCell: () => ({ id: `${i}` }),
				onCell: () => ({ id: `${i}` }),
			}),
		),
	);
	const sensors = useSensors(
		useSensor(PointerSensor, {
			activationConstraint: {
				// https://docs.dndkit.com/api-documentation/sensors/pointer#activation-constraints
				distance: 1,
			},
		}),
	);
	const onDragEnd = ({ active, over }: DragEndEvent) => {
		if (active.id !== over?.id) {
			setColumns(prevState => {
				const activeIndex = prevState.findIndex(
					i => i.key === (active === null || active === void 0 ? void 0 : active.id),
				);
				const overIndex = prevState.findIndex(
					i => i.key === (over === null || over === void 0 ? void 0 : over.id),
				);
				return arrayMove(prevState, activeIndex, overIndex);
			});
		}
		setDragIndex({ active: -1, over: -1 });
	};
	const onDragOver = ({ active, over }: DragOverEvent) => {
		const activeIndex = columns.findIndex(i => i.key === active.id);
		const overIndex = columns.findIndex(
			i => i.key === (over === null || over === void 0 ? void 0 : over.id),
		);
		setDragIndex({
			active: active.id,
			over: over === null || over === void 0 ? void 0 : over.id,
			direction: overIndex > activeIndex ? 'right' : 'left',
		});
	};
	return (
		<Flex gap="middle" vertical>
			<Flex align="center" gap="middle">
				<Button type="primary" onClick={downloadCSV} loading={loading} className='bg-primary'>
					下载Excel
				</Button>
			</Flex>
			<DndContext
				sensors={sensors}
				modifiers={[restrictToHorizontalAxis]}
				onDragEnd={onDragEnd}
				onDragOver={onDragOver}
				collisionDetection={closestCenter}
			>
				<SortableContext items={columns.map(i => i.key)} strategy={horizontalListSortingStrategy}>
					<DragIndexContext.Provider value={dragIndex}>
						<Table
							rowKey="key"
							columns={columns}
							dataSource={data}
							scroll={{ x: 'max-content', y: 500 }}
							onChange={(pagination, filters, sorter, extra) => {
								setFilterData(extra.currentDataSource)
							}}
							pagination={false}
							components={{
								header: { cell: TableHeaderCell },
								body: { cell: TableBodyCell },
							}}
						/>
					</DragIndexContext.Provider>
				</SortableContext>
				<DragOverlay>
					<th style={{ backgroundColor: 'gray', padding: 16 }}>
						{(_a = columns[columns.findIndex(i => i.key === dragIndex.active)]) === null ||
							_a === void 0
							? void 0
							: _a.title}
					</th>
				</DragOverlay>
			</DndContext>
			{filterData.length ? `${filterData.length} 个数据` : data.length ? `${data.length} 个数据` : null}
		</Flex>
	)
}



const App = (props) => <div className='bg-white p-5'><Tabs defaultActiveKey="1" items={
  [{
    key: '1',
    label: '卵巢',
    children: <BaseTable {...props} disease={'ovarian_dwi'} />,
  },
  {
    key: '2',
    label: '宫颈',
    children: <BaseTable {...props} disease={'cervical_mre'}/>,
  }]
} /></div>;


export default App;
