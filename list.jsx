import React, {Fragment} from 'react';
import _ from 'lodash';
import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import {Link} from 'react-router-dom';
import Tooltip from 'rc-tooltip';

import Base from 'services/base';
import showAlert from 'services/alert';
import {
    isSuperAdmin,
    isReadOnly,
} from 'services/user';

import {intentReportConstants, intentReportOperations} from 'modules/intent-reports';
import {userOperations} from 'modules/user';
import {CONTENT_FORM_DATE_FORMAT_SEGMENT} from 'modules/core/constants';
import {
    INTENT_REPORTS_TYPES_MAP,
    INTENT_REPORTS_INPUT_TOOLTIP,
} from 'modules/intent-reports/constants';

import Input from 'components/core/input';
import MainContent from 'components/core/main-content';
import PageContainer from 'components/core/page-container';
import Pagination from 'components/core/pagination';
import Table from 'components/core/table';
import TableBody from 'components/core/table-body';
import TableHead from 'components/core/table-head';
import ActionPanel from 'components/core/action-panel';
import TablePanel from 'components/core/table-panel';
import Button from 'components/core/button';
import ClientAlert from 'components/user/client-alert';
import ModalDelete from 'components/core/modal-delete';
import ModalConfirmWithInput from 'components/core/modal-confirm-with-input';
import SubHeader from 'components/core/sub-header';
import ExportModal from 'components/intent-reports/export-modal';

import ExportLogo from 'images/export.svg';
import IntentReportIcon from 'images/intent-reports.svg';
import './intent-reports-list.less';
import moment from 'moment';
import InsightsLogo from 'images/insights.svg';

const mapStateToProps = state => {
    return {
        ..._.pick(state, ['intentReports', 'user']),
    };
};

const mapDispatchToProps = dispatch => {
    return {
        actions: bindActionCreators(
            {
                clearReportActionResult: intentReportOperations.clearActionResult,
                clearUserActionResult: userOperations.clearActionResult,
                fetchAllIntentReports: intentReportOperations.fetchAll,
                fetchListIntentReports: intentReportOperations.fetchList,
                askRemoveReport: intentReportOperations.askRemove,
                askCloneReport: intentReportOperations.askClone,
                removeReport: intentReportOperations.remove,
                cloneReport: intentReportOperations.clone,
                createReport: intentReportOperations.create,
                selectReportPage: intentReportOperations.selectPage,
                sortReports: intentReportOperations.sort,
                changeItemsPerPage: intentReportOperations.changeItemsPerPage,
                toggleReportActions: intentReportOperations.toggleActions,
                userToggleVisibility: userOperations.toggleVisibility,
                dropFilter: intentReportOperations.dropFilter,
                exportIntentReport: intentReportOperations.exportIntentReport,
            },
            dispatch
        ),
    };
};

const getActionResult = state => {
    return _.get(state, 'intentReports.actionResult') || _.get(state, 'user.actionResult');
};

class IntentReportsList extends Base {
    constructor(props) {
        super(props);
        this.state = {
            exportModalOpened: false,
            reportToExport: null,
        };
    }

    componentDidMount() {
        this.props.actions.fetchAllIntentReports();
    }

    UNSAFE_componentWillUpdate(nextProps) {
        const actionResult = getActionResult(nextProps);
        if (actionResult) {
            if (actionResult.code !== '40056')
                showAlert({
                    type: actionResult.type,
                    text: actionResult.message,
                    title: actionResult.type,
                    onClose: this.triggerClearActionResult,
                });
        }
    }

    componentWillUnmount() {
        this.props.actions.dropFilter();
    }

    triggerClearActionResult() {
        const {clearReportActionResult, clearUserActionResult} = this.props.actions;

        clearReportActionResult();
        clearUserActionResult();
    }

    notAvailableForLicense() {
        return (
            <div styleName='not-available-license-wrapper'>
                <div><InsightsLogo/></div>
                <div styleName='not-available-license-title-wrapper'>
                    <span>Intent reports are not available for your license</span>
                </div>
                <div styleName='not-available-license-subTitle-wrapper'>
                    <span>Please contact your customer success manager to enable them.</span>
                </div>
            </div>
        );
    }

    render() {
        const props = this.props;

        const {
            actions: {
                fetchAllIntentReports,
                removeReport,
                cloneReport,
                askRemoveReport,
                askCloneReport,
                sortReports,
                userToggleVisibility,
                toggleReportActions,
                exportIntentReport,
                fetchListIntentReports,
            },
            intentReports: {
                askRemoveReportId,
                cloneReportId,
                cloneReportName,
                filter,
                isFetching,
                items = [],
                itemsList = [],
                orderColumn,
                orderDirection,
                selectedItem,
                pagination,
                isExporting,
                isSaving,
            },
            user: {
                entity,
                intentReportsStatus,
            },
        } = props;

        const isUserSuperAdmin = isSuperAdmin(entity);
        const isUserReadOnly  = isReadOnly(entity);

        const sortedColumns = _.sortBy(_.compact([
            ...intentReportConstants.INTENT_REPORT_LIST_COLUMNS,
            isUserSuperAdmin ? {
                text: 'ID',
                key: 'id',
                position: 0,
                width: 8,
            } : null,
            {
                text: 'Actions',
                width: 5,
                excludeFromSorting: true,
            },
        ]), 'position');
        let isFiltered = false;
        let searchString = '';
        if (filter) {
            isFiltered = !_.isEmpty(filter['filter[name]']);
            searchString = _.get(filter, ['filter[name]'], '');
        }

        const tableActions = item => {
            return [
                {
                    text: 'Export',
                    key: 'export',
                    icon: <ExportLogo className='nav-export-button' />,
                    onClick: () => exportIntentReport(item.id),
                    tooltip: 'Export the report',
                },
                {
                    text: 'Settings',
                    key: 'settings',
                    icon: 'mi-settings',
                    link: `/intent-reports/${item.id}/settings`,
                    tooltip: 'Open the report settings',
                },
                {
                    text: 'Clone',
                    key: 'clone',
                    icon: 'mi-content-copy',
                    onClick: () => askCloneReport(item.id),
                    tooltip: 'Clone the report',
                    disabled: isUserReadOnly,
                },
                {
                    text: 'Delete',
                    key: 'delete',
                    icon: 'mi-delete',
                    color: 'danger',
                    onClick: () => askRemoveReport(item.id),
                    tooltip: 'Delete the report',
                    disabled: isUserReadOnly,
                },
            ];
        };

        const itemsMapped = items.map(item => ({
            id: item.id,
            type: <div styleName=" contentIconWrapper">
                <i
                    styleName="contentIcon"
                    className={`top-bar-first-element-icon ${INTENT_REPORTS_TYPES_MAP[item.type].icon}`} />
                {INTENT_REPORTS_TYPES_MAP[item.type].label || item.type}
            </div>,
            name: <Link to={`/intent-reports/${item.id}`}>
                <div style={{display: 'flex', alignItems: 'center', wordBreak: 'break-word'}}>
                    {item.name}
                </div>
            </Link>,
            accountsNum: `${item.accountsNum || 0} (${item.newAccountsNum} new)`,
            updatedAt: item.synchronizedAt ? moment(item.synchronizedAt).utc().format(CONTENT_FORM_DATE_FORMAT_SEGMENT) : '—',
            createdAt: moment(item.createdAt).utc().format(CONTENT_FORM_DATE_FORMAT_SEGMENT),
        }));

        const notFound = <div className="panel panel-flat"><div styleName="nothing-found-content">
            <Fragment>
                <IntentReportIcon styleName="no-reports-icon" />
                No intent captured yet
            </Fragment>
            {!isReadOnly(entity) ? <Button
                className="btn create-campaign-link"
                styleName="nothing-found-button"
                onClick={() => {}}
                text="Create your first intent report"
                disabled={true || isUserReadOnly}
            /> : null}
        </div></div>;

        return (
            <div className={'campaign-list-page-wrapper'}>
                <div
                    className="campaign-list intent-reports-list"
                    onClick={() => {
                        userToggleVisibility({});
                        toggleReportActions({});
                    }}
                >
                    <ClientAlert />
                    <PageContainer>
                        {askRemoveReportId ? <ModalDelete
                            title="a report"
                            message={`report “${_.find(items, {id: askRemoveReportId})?.name || ''}”? You can’t undo this operation.`}
                            visible={Boolean(askRemoveReportId)}
                            onDelete={removeReport}
                            onCancel={() => askRemoveReport(false)}
                            deleteButtonText="report"
                        /> : <></>}
                        {cloneReportId ? <ModalConfirmWithInput
                            type="cloneReport"
                            visible={Boolean(cloneReportId)}
                            title="Clone intent report"
                            message="Intent report name"
                            placeholder="Enter intent report name"
                            name={cloneReportName}
                            okButtonText="CLONE"
                            onOk={cloneReport}
                            onCancel={() => askCloneReport(false)}
                            reverseButtons={true}
                            isCheckUnique={false}
                            disabled={isSaving}
                        /> : <></>}
                        <MainContent>
                            {!intentReportsStatus ? this.notAvailableForLicense() :
                                itemsMapped.length === 0 && !isFiltered && !isFetching && searchString !== '' ? notFound :
                                    <Table
                                        tableMinWidth={1185}
                                        isLoading={isFetching}
                                        columnWidths={sortedColumns.map(item => item.width || 8)}
                                        additionalStyle="campaignList"
                                        wrapperClassNames={['campaign-flat']}
                                        tableClassNames={['chart']}
                                        topPanel={
                                            <Fragment>
                                                <div styleName='navigation-wrapper'>
                                                    <SubHeader selectedName='Intent reports' />
                                                </div>
                                                <ActionPanel
                                                    left={
                                                        <Link
                                                            className="btn create-intent-report-link"
                                                            to={'/intent-reports/create'}
                                                            disabled={isUserReadOnly}
                                                        >
                                                            <i className="icon-plus3" />
                                                            Intent report
                                                        </Link>
                                                    }
                                                    right={
                                                        <Fragment>
                                                            <div className="btn-group" styleName=" top-actions">
                                                                <Tooltip
                                                                    placement='bottom'
                                                                    overlay={<div style={{width:215}}>
                                                                        {INTENT_REPORTS_INPUT_TOOLTIP}
                                                                    </div>}
                                                                >
                                                                    <div className='campaign-data-search'>
                                                                        <Input
                                                                            type="search"
                                                                            value={searchString}
                                                                            iconName="mi-search"
                                                                            className="search-input-campaign-form"
                                                                            classNameInput="search-input"
                                                                            placeholder="Search"
                                                                            onInput={e =>
                                                                                fetchAllIntentReports({'filter[name]': e.target.value})
                                                                            }
                                                                        />
                                                                    </div>
                                                                </Tooltip>
                                                                <div style={{marginLeft: 15}}>
                                                                    <Button
                                                                        buttonIcon={<ExportLogo style={{fill: '#8B9BAC'}} />}
                                                                        text="Export"
                                                                        color="teal"
                                                                        className="btn bordered-button hide-inactive-button"
                                                                        onClick={() => {
                                                                            fetchListIntentReports()
                                                                                .then(() => this.setState({
                                                                                    exportModalOpened: true,
                                                                                }));
                                                                        }}
                                                                    />
                                                                </div>
                                                            </div>
                                                        </Fragment>
                                                    }
                                                />
                                            </Fragment>
                                        }
                                        head={
                                            <TableHead
                                                columns={sortedColumns}
                                                orderColumn={orderColumn}
                                                orderDirection={orderDirection}
                                                onClickByColumnHeader={sortReports}
                                                textAttribute="text"
                                            />
                                        }
                                        body={
                                            <TableBody
                                                id={'intent-reports-list'}
                                                items={itemsMapped}
                                                selectedItem={selectedItem}
                                                actions={tableActions}
                                                isDropdown={true}
                                                onUserFocusOnItem={data => {
                                                    userToggleVisibility({});
                                                    toggleReportActions(data);
                                                }}
                                                onToggleActions={toggleReportActions}
                                                isUserSuperAdmin={isUserSuperAdmin}
                                            />
                                        }
                                        bottomPanel={
                                            <TablePanel
                                                right={
                                                    <Pagination
                                                        selectedPage={_.get(pagination, ['selectedPage'])}
                                                        itemsPerPage={_.get(pagination, ['itemsPerPage'])}
                                                        pageCount={_.get(pagination, ['pageCount'])}
                                                        totalCount={_.get(pagination, ['totalCount'])}
                                                        onSelect={_.get(props, ['actions', 'selectReportPage'])}
                                                        onChangeItemsPerPage={_.get(props, ['actions', 'changeItemsPerPage'])}
                                                    />
                                                }
                                                rightSize={12}
                                            />
                                        }
                                    />}
                            {this.state.exportModalOpened ? <ExportModal
                                exportModalOpened={this.state.exportModalOpened}
                                onToggleExportModal={() => {
                                    this.setState({
                                        reportToExport: null,
                                        exportModalOpened: !this.state.exportModalOpened,
                                    });
                                }}
                                items={_.map(itemsList, i => ({value: i.id, label: i.name}))}
                                onDownload={({value}) => exportIntentReport(value)
                                    .then(() => this.setState({
                                        reportToExport: null,
                                        exportModalOpened: false,
                                    }))}
                                updateToSelectExport={id => this.setState({reportToExport: id})}
                                selectedForExport={this.state.reportToExport}
                                isExporting={isExporting}
                            /> : <></>}
                        </MainContent>
                    </PageContainer>
                </div>
            </div>

        );
    }
}

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(IntentReportsList);
