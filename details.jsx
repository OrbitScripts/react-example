import React, {Fragment} from 'react';
import _ from 'lodash';
import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import moment from 'moment';
import {Link} from 'react-router-dom';
import {reduxForm, getFormValues, getFormSyncErrors, initialize} from 'redux-form';
import Tooltip from 'rc-tooltip';

import Base from 'services/base';
import showAlert from 'services/alert';
import {handleImageError} from 'services/utils';
import {isReadOnly} from 'services/user';

import {intentReportConstants, intentReportOperations} from 'modules/intent-reports';
import {userOperations} from 'modules/user';
import {dashboardOperations} from 'modules/dashboard';
import {CONTENT_FORM_DATE_FORMAT_SEGMENT} from 'modules/core/constants';
import {
    INTENT_REPORT_DETAILS_FIRST_PARTY_TREND_VALUES,
    INTENT_REPORT_SCORING_FILTER_OPTIONS,
    INTENT_REPORT_STATE,
    INTENT_REPORTS_TYPES,
    INTENT_REPORTS_TYPES_MAP,
} from 'modules/intent-reports/constants';
import {
    getPeriodFilterOptions,
    prepareIndustriesForFilter,
    prepareEmployeesForFilterWithIds,
} from 'modules/intent-reports/helpers';
import {accountOperations} from 'modules/account';
import {SUB_HEADER_CONTENT_TYPE} from 'modules/core/constants';
import {dictionaryEditOperations} from 'modules/dictionary';

import SubHeader from 'components/core/sub-header';
import PageNav from 'components/core/page-nav';
import Input from 'components/core/input';
import {Select} from 'components/custom';
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
import CountryFilter from 'components/filters/country-filter';
import AccountSizeFilter from 'components/account/employees-filter';
import IndustryFilter from 'components/account/industry-filter';
import BlockUI from 'components/core/block-ui';
import {RadioNew} from 'components/core/form';

import ExportLogo from 'images/export.svg';
import LoadingLogo from 'images/logo-loading-anim.svg';
import SearchFolderLogo from 'images/search-folder.svg';
import DocumentErrorLogo from 'images/document-error.svg';
import FilterLogo from 'images/filter.svg';
import SpinnerMini18 from 'images/spinner-mini-18.svg';

import styles from './intent-report-details.less';

const mapStateToProps = state => {
    return {
        ..._.pick(state, ['intentReports', 'user', 'account']),
        formValues: getFormValues('intentReport')(state),
        formErrors: getFormSyncErrors('intentReport')(state),
        employees: state.dictionary.employees,
    };
};

const mapDispatchToProps = dispatch => {
    return {
        actions: bindActionCreators(
            {
                clearReportActionResult: intentReportOperations.clearActionResult,
                clearUserActionResult: userOperations.clearActionResult,
                fetchDetails: intentReportOperations.fetchDetails,
                askRemoveReport: intentReportOperations.askRemove,
                removeReport: intentReportOperations.remove,
                selectReportDetailsPage: intentReportOperations.selectDetailsPage,
                sortDetailsReports: intentReportOperations.sortDetails,
                changeItemsPerDetailsPage: intentReportOperations.changeItemsPerDetailsPage,
                toggleReportActions: intentReportOperations.toggleActions,
                userToggleVisibility: userOperations.toggleVisibility,
                dropFilter: intentReportOperations.dropFilterDetails,
                patchIntentReportName: intentReportOperations.patchIntentReportName,
                updateAccountCountryCodeToSelectFilter: dashboardOperations.updateAccountCountryCodeToSelectFilter,
                fetchIndustries: accountOperations.fetchIndustries,
                updateIndustries: intentReportOperations.updateIndustries,
                updateSize: intentReportOperations.updateSize,
                updateCountries: intentReportOperations.updateCountries,
                clearItemsDetails: intentReportOperations.clearItemsDetails,
                exportIntentReport: intentReportOperations.exportIntentReport,
                fetchEmployees: dictionaryEditOperations.fetchEmployees,
                initialize: initialize,
            },
            dispatch,
        ),
    };
};

const getActionResult = state => {
    return _.get(state, 'intentReports.actionResult')
        || _.get(state, 'user.actionResult')
        || _.get(state, 'account.actionResult');
};

const getReportId = () => {
    const id = window.location.href.match(/intent-reports\/(\d+)/);
    return _.get(id, '[1]', '');
};

class IntentReportDetails extends Base {
    constructor(props) {
        super(props);

        this.state = {
            isNameFormOpened: false,
        };
    }

    componentDidMount() {
        const {
            actions: {
                dropFilter,
                fetchDetails,
                fetchIndustries,
                fetchEmployees,
            },
        } = this.props;
        dropFilter();

        const id = getReportId();
        fetchDetails({id});
        fetchIndustries(false);
        fetchEmployees();
    }

    componentDidUpdate(prevProps) {
        const oldName = prevProps.intentReports?.currentReport?.name;
        const name = this.props.intentReports?.currentReport?.name;
        if (!oldName && name) {
            this.props.initialize({name});
            this.setState({subHeaderValue: name});
        }
    }

    UNSAFE_componentWillUpdate(nextProps) {
        const actionResult = getActionResult(nextProps);
        if (actionResult) {
            showAlert({
                type: actionResult.type,
                text: actionResult.message,
                title: actionResult.type,
                onClose: this.triggerClearActionResult,
            });
        }
    }

    componentWillUnmount() {
        this.props.actions.clearItemsDetails();
    }

    triggerClearActionResult() {
        const {clearReportActionResult, clearUserActionResult} = this.props.actions;

        clearReportActionResult();
        clearUserActionResult();
    }

    getScoreLevel(score) {
        switch (true) {
        case score >= 0 && score <= 39:
            return 'Low';
        case score >= 40 && score <= 69:
            return 'Medium';
        case score >= 70 && score <= 100:
            return 'High';
        }
        return '';
    }

    async subHeaderOnBlur(value) {
        const {
            formErrors,
            actions: {
                patchIntentReportName,
            },
        } = this.props;
        const {subHeaderValue} = this.state;
        const name = _.trim(value);
        if (name && name === subHeaderValue && !formErrors?.name) return Promise.resolve();
        if (name && name !== subHeaderValue && !formErrors?.name) {
            await patchIntentReportName({name}).then(res => {
                if (!res.payload.errors?.length) {
                    this.setState({subHeaderValue: name});
                    return Promise.resolve();
                } else {
                    return Promise.reject();
                }
            });
        } else return Promise.reject();
    }

    render() {
        const props = this.props;

        const {
            history,
            employees,
            actions: {
                removeReport,
                askRemoveReport,
                sortDetailsReports,
                userToggleVisibility,
                toggleReportActions,
                fetchDetails,
                updateIndustries,
                updateCountries,
                updateSize,
                exportIntentReport,
            },
            intentReports: {
                askRemoveReportId,
                itemsDetails: items = [],
                selectedItem,
                isFetching,
                isExporting,
                currentReport: {
                    id,
                    name,
                    intentUseCase,
                    createdAt,
                    synchronizedAt,
                    newAccountsNum,
                    filter,
                    orderColumn,
                    orderDirection,
                    pagination,
                    selectedIndustries,
                    selectedCountries,
                    selectedSize,
                    state,
                    totalCount,
                    totalNewCount,
                } = {},
            },
            user: {
                entity,
                intentReportsStatus,
            },
            formValues,
        } = props;

        const isUserReadOnly  = isReadOnly(entity);

        const icons = _.get(props, 'account.iconsCache', {});
        const intentReportName = name || '';

        const periodFilterOptions = getPeriodFilterOptions(createdAt);
        const industriesForFilter = prepareIndustriesForFilter(props.account.industries);
        const employeesForFilter = prepareEmployeesForFilterWithIds(employees);

        const sortedColumns = _.sortBy(_.compact([
            ...intentReportConstants.INTENT_REPORT_DETAILS_COLUMNS,
        ]), 'position');

        const isFiltered = filter ? !_.isEmpty(filter['filter[accountGroup][description]']) : false;
        const selectedIntentReportData = filter ? _.find(INTENT_REPORT_SCORING_FILTER_OPTIONS, {value: filter['fields[intentReportData]']}) : undefined;
        const selectedRecordedAt = filter ? _.find(periodFilterOptions, {value: {from: filter['filter[recordedAt][from]'], to: filter['filter[recordedAt][to]']}}) : undefined;
        const currentSearch = filter ? _.get(filter, ['filter[accountGroup][description]'], '') : '';
        const selectedNoveltyType = filter ? _.get(filter, ['filter[accountGroup][type]'], '') : '';

        const getLocationTooltip = list => {
            const statusesList = ['High', 'Medium', 'Low'];
            const locationWithScore = list.map(i => {
                const scoreLevel = this.getScoreLevel(i?.meta?.combinedScore || 0);
                return {
                    id: i.id,
                    name: i.name,
                    scoreLevel,
                };
            });

            return (
                <div className='location-tooltip'>
                    {_.compact(_.map(statusesList, (i, index) => {
                        const filteredLocations = _.filter(locationWithScore, item => {
                            return item.scoreLevel === i;
                        });
                        return filteredLocations.length ? (
                            <div key={index} styleName={`score ${i.toLowerCase()}`}>
                                <div styleName='tooltip-title'>{i} intent</div>
                                {_.map(filteredLocations, (item, idx) => <div key={idx} styleName='tooltip-text'>{item.name}</div>)}
                            </div>
                        ) : null;
                    }))}
                </div>
            );
        };
        const itemsMapped = items.map(item => ({
            account: <div className={styles['account-cell']}>
                <div className={styles['account-cell__image']}>
                    <img
                        alt={_.get(item, 'domain')}
                        src={`${icons[_.get(item, 'domain')]}?size=32`}
                        onError={handleImageError}
                    />
                </div>
                <div>
                    <div className={styles['account-cell__name']}>
                        <Link to={`/intent-reports/${id}/account/dashboard?id=${item.id}`}>
                            {item.name}
                        </Link>
                    </div>
                    <div className={styles['account-cell__domain']}>{item.domain}</div>
                </div>
            </div>,
            combinedScore: {
                value: <div className={styles['score-cell']}><div className={styles['score-cell__value']}>{item.combinedScore}</div></div>,
                tooltip: {
                    placement: 'top',
                    text: <div className='tooltip-cell'>
                        <div><b>3rd party score</b></div>
                        <div style={{fontSize: 15, marginTop: 4}}>
                            {this.getScoreLevel(item.thirdPartyScore)} ({item.thirdPartyScore})
                        </div>
                        <br/>
                        <div><b>1st party score</b></div>
                        <div style={{fontSize: 15, marginTop: 4}}>
                            {this.getScoreLevel(item.firstPartyScore)} ({item.firstPartyScore})
                        </div>
                    </div>,
                },
            },
            scoredIntentTopics: item.scoredIntentTopics ?
                {
                    value: `${item.scoredIntentTopics} ${item.scoredIntentTopicCount - 1 > 0 ? '(+' + (item.scoredIntentTopicCount - 1) + ')' : ''}`,
                    tooltip: {
                        placement: 'top',
                        text: item.scoredIntentTopicsList.map((itemList, index) => {
                            return (
                                <div key={itemList.id + index} className='tooltip-cell'>
                                    {itemList.name}
                                    <div className='tooltip-cell__score'>{itemList.meta.combinedScore}</div>
                                </div>
                            );
                        }),
                    },
                } : {
                    value: <span className={styles['account-cell__n-a']}>&mdash;</span>,
                    tooltip: {
                        text: <div className={styles['account-cell__n-a-text']}>Intent topics are not available, since this intent report is not using &quot;Research on 3rd party websites&quot; as the intent source.</div>,
                        placement: 'top',
                        overlayClassName: 'account-cell__n-a-tooltip',
                    },
                },
            firstPartyTrend: <div className={styles['cell']}>
                {item.firstPartyTrend !== null ? item.firstPartyTrend : ''}
                <span className={styles['cell__arrow']}>
                    {item.firstPartyTrend === INTENT_REPORT_DETAILS_FIRST_PARTY_TREND_VALUES.SURGING
                        ?  <i className="mi-arrow-upward" />
                        : (item.firstPartyTrend === INTENT_REPORT_DETAILS_FIRST_PARTY_TREND_VALUES.DROPPING
                            ? <i className="mi-arrow-downward" /> : <i className="icon-dash" /> )
                    }
                </span>
            </div>,
            scoredGeoLocations: item.scoredGeoLocations ?
                {
                    value: `${item.scoredGeoLocations} ${item.scoredGeoLocationCount - 1 > 0 ? '(+' + (item.scoredGeoLocationCount - 1) + ')' : ''}`,
                    tooltip: {
                        text: getLocationTooltip(item.scoredGeoLocationsList),
                    },
                } : {
                    value: <span className={styles['account-cell__n-a']}>&mdash;</span>,
                    tooltip: {
                        hide: true,
                    },
                },
        }));

        const isApplyDisabled = _.every([
            _.isNil(selectedSize) || _.isEqual(_.map(selectedSize, 'value'), _.get(filter, ['filter[accountGroup][size]'])),
            _.isNil(selectedCountries) || _.isEqual(_.map(selectedCountries, 'value'), _.get(filter, ['filter[accountGroup][country]'])),
            _.isNil(selectedIndustries) || _.isEqual(_.map(selectedIndustries, 'value'), _.get(filter, ['filter[accountGroup][industry]'])),
        ]);

        let notFound;
        switch (state) {
        case INTENT_REPORT_STATE.CREATED:
        case INTENT_REPORT_STATE.SYNC_IN_PROGRESS:
            notFound = <div className="panel panel-flat intent-report-details-flat">
                <div className={styles['no-report-icon']}>
                    <LoadingLogo className={styles['no-report-icon__anim']} />
                    <p className={styles['no-report-icon__load-text']}>Generating report...</p>
                    <p className={styles['no-report-icon__title']}>Report generation in progress</p>
                    <p className={styles['no-report-icon__message']}>The report is being generated.
                        Estimated time of completion is 10 minutes.<br/>
                        You will be notified by email when the report is ready.</p>
                </div>
            </div>;
            break;
        case INTENT_REPORT_STATE.SYNC_ERROR:
            notFound = <div className="panel panel-flat intent-report-details-flat">
                <div className={styles['sync-error-report']}>
                    <DocumentErrorLogo className={styles['sync-error-report__img']} />
                    <p className={styles['sync-error-report__title']}>There was an error with the report settings, apologies!</p>
                    <p className={styles['sync-error-report__message']}>
                        For some reason, the report can&apos;t generate any results. N.Rich team has been notified.
                        Please try to <Link to={`/intent-reports/${id}/settings`} className={styles['sync-error-report__link']}>edit your report</Link>.
                        If the issue persists, you can get in touch with us using the chat button at the bottom right
                        corner, or send us email on <a href='mailto:support@n.rich' className={styles['sync-error-report__link']}>support@n.rich</a>.
                    </p>
                </div>
            </div>;
            break;
        case INTENT_REPORT_STATE.NOT_ENOUGH_FIRST_PARTY_DATA:
            notFound = <div className="panel panel-flat intent-report-details-flat">
                <div className={styles['no-report-empty']}>
                    <SearchFolderLogo className={styles['no-report-empty__img']} />
                    <p className={styles['no-report-empty__message']}>No results available.<br />
                        Please edit your
                        <Link to={`/intent-reports/${id}/settings`}
                            className={styles['no-report-empty__link']}> 1st party data settings </Link>
                        to find accounts with intent.
                        <br /><br />
                        This normally happens when your selected ABM campaigns have low results or website
                        scope has low number of visits for the selected period.
                    </p>
                </div>
            </div>;
            break;
        case INTENT_REPORT_STATE.SYNCHRONIZED:
        default:
            notFound = <div className="panel panel-flat intent-report-details-flat">
                <div className={styles['no-report-empty']}>
                    <SearchFolderLogo className={styles['no-report-empty__img']} />
                    <p className={styles['no-report-empty__message']}>
                        No results available.<br />
                        Please edit your
                        <Link to={`/intent-reports/${id}/settings`}
                            className={styles['no-report-empty__link']}> settings </Link>
                        or filters to find some accounts with intent.
                    </p>
                </div>
            </div>;
            break;
        }

        if (!intentReportsStatus) history.push('/intent-reports');

        let reportTypeTooltipText;
        switch (intentUseCase) {
        case INTENT_REPORTS_TYPES.NET_NEW_DEMAND:
            reportTypeTooltipText = 'Weights: 80% 3rd party and 20% 1st party. Used to identify Top-Of-the-Funnel accounts.';
            break;
        case INTENT_REPORTS_TYPES.HOT_DEMAND:
            reportTypeTooltipText = 'Weights: 20% 3rd party and 80% 1st party. Used to identify Bottom-Of-the-Funnel accounts.';
            break;
        case INTENT_REPORTS_TYPES.ENGAGED_DEMAND:
            reportTypeTooltipText = 'Weights: 40% 3rd party and 60% 1st party. Used to identify Middle-Of-the-Funnel accounts.';
            break;
        case INTENT_REPORTS_TYPES.CUSTOM:
        default:
            reportTypeTooltipText = 'Custom weights as specified in the intent report settings.';
            break;
        }
        const reportTypeTooltip = <Tooltip
            placement='top'
            overlay={<div style={{width: 200, textAlign: 'left'}}>{reportTypeTooltipText}</div>}>
            <i className="mi-info-outline segment-form-info-tooltip-icon" style={{color: '#999'}}/>
        </Tooltip>;

        return (
            <div className={'campaign-list-page-wrapper'}>
                <div
                    className="campaign-list intent-reports-details"
                    onClick={() => {
                        userToggleVisibility({});
                        toggleReportActions({});
                    }}
                >
                    <ClientAlert/>
                    <PageContainer>
                        <div className="panel panel-flat tabs-account">
                            {askRemoveReportId ? <ModalDelete
                                title="a report"
                                message={`report “${name || ''}”? You can’t undo this operation.`}
                                visible={Boolean(askRemoveReportId)}
                                onDelete={removeReport}
                                onCancel={() => askRemoveReport(false)}
                                deleteButtonText="report"
                            /> : <></>}
                            <ActionPanel
                                additionalClasses='intent-report-navigation-panel'
                                left={<PageNav item={{name: 'All intent reports', link: '/intent-reports'}} />}
                            />
                            <ActionPanel
                                additionalClasses={'action-panel_with-border-bottom intent-report-info-panel'}
                                left={<SubHeader
                                    contentTitle='Intent report'
                                    isEditName
                                    isLogo
                                    selectedName={formValues?.name}
                                    logoText={intentReportName}
                                    contentType={SUB_HEADER_CONTENT_TYPE.INTENT_REPORT}
                                    onBlur={this.subHeaderOnBlur}
                                />}
                                center={
                                    <div className={styles['stats-block']}>
                                        <div className={styles['stats-block__updated']}>
                                            <div className={styles['stats-block__updated-title']}>
                                                <span>Last updated</span>
                                                <Tooltip
                                                    placement='top'
                                                    overlay={<div style={{width: 200, textAlign: 'left'}}>
                                                        Date of intent report last update. Intent report data is
                                                        updated weekly on Mondays.
                                                    </div>}>
                                                    <i className="mi-info-outline segment-form-info-tooltip-icon" style={{color: '#999'}}/>
                                                </Tooltip>
                                            </div>
                                            <div className={styles['stats-block__updated-value']}>{
                                                synchronizedAt ? moment(synchronizedAt).utc()
                                                    .format(CONTENT_FORM_DATE_FORMAT_SEGMENT) : '—'
                                            }</div>
                                        </div>
                                        <div className={styles['stats-block__new']}>
                                            <div className={styles['stats-block__new-title']}>
                                                New accounts
                                                <Tooltip
                                                    placement='top'
                                                    overlay={<div style={{width: 200, textAlign: 'left'}}>
                                                        New accounts that appeared during the past week.
                                                    </div>}>
                                                    <i className="mi-info-outline segment-form-info-tooltip-icon" style={{color: '#999'}}/>
                                                </Tooltip>
                                            </div>
                                            <div
                                                className={styles['stats-block__updated-value']}>{newAccountsNum}</div>
                                        </div>
                                    </div>
                                }
                                right={
                                    <Fragment>
                                        <div className="btn-group" styleName="top-actions">
                                            <div style={{marginLeft: 15}}>
                                                <Button
                                                    buttonIcon={<i className="mi-settings"/>}
                                                    text="Settings"
                                                    color="teal"
                                                    className="btn bordered-button hide-inactive-button"
                                                    onClick={() => this.props.history.push(`/intent-reports/${id}/settings`)}
                                                    disabled={!id}
                                                />
                                            </div>
                                        </div>
                                        <div className="btn-group" styleName=" top-actions">
                                            <div style={{marginLeft: 15}}>
                                                <Button
                                                    text="Export"
                                                    color="teal"
                                                    className="btn bordered-button hide-inactive-button"
                                                    onClick={() => exportIntentReport(id)}
                                                    disabled={isExporting}
                                                    buttonIcon={
                                                        isExporting ?  <i className={'spinner'}><SpinnerMini18/></i>: <ExportLogo
                                                            style={{fill: '#8B9BAC'}}
                                                        />
                                                    }
                                                />
                                            </div>
                                        </div>
                                        <Button
                                            className='btn bg-custom-1 delete'
                                            text=''
                                            iconName="mi-delete"
                                            disabled={isUserReadOnly}
                                            onClick={() => askRemoveReport(getReportId())}
                                        />
                                    </Fragment>
                                }
                            />
                            <ActionPanel
                                left={intentUseCase && <div styleName="report-type">
                                    <i
                                        styleName="contentIcon"
                                        className={`top-bar-first-element-icon ${INTENT_REPORTS_TYPES_MAP[intentUseCase].icon}`}/>
                                    {INTENT_REPORTS_TYPES_MAP[intentUseCase].label || intentUseCase}
                                    {reportTypeTooltip}
                                </div>}
                                right={<div styleName="extended-filters">
                                    <div className={styles['novelty-filter']}>
                                        <RadioNew
                                            className={styles[selectedNoveltyType === 'all'
                                                ? 'novelty-filter__item_active' :'novelty-filter__item']}                                            id={'accountsFirmographic'}
                                            checked={selectedNoveltyType === 'all'}
                                            label={`All accounts (${totalCount})`}
                                            input={{onChange: () => fetchDetails({'filter[accountGroup][type]': 'all'})}}
                                        />
                                        <RadioNew
                                            className={styles[selectedNoveltyType === 'new'
                                                ? 'novelty-filter__item_active' :'novelty-filter__item']}
                                            checked={selectedNoveltyType === 'new'}
                                            id={'accountsSegments'}
                                            label={`New this week (${totalNewCount})`}
                                            input={{onChange: () => fetchDetails({'filter[accountGroup][type]': 'new'})}}
                                        />
                                    </div>
                                    <Select
                                        styleName="scoring-filter-select"
                                        isMulti={false}
                                        value={selectedIntentReportData}
                                        placeholder='Select'
                                        options={INTENT_REPORT_SCORING_FILTER_OPTIONS}
                                        onChange={value => {
                                            fetchDetails({'fields[intentReportData]': value.value});
                                        }}
                                        closeMenuOnSelect={true}
                                        formatOptionLabel={(option, {context}) => {
                                            return context === 'menu' ? option.label : option.selectedLabel;
                                        }}
                                    />
                                    <Select
                                        styleName="period-filter-select"
                                        isMulti={false}
                                        value={selectedRecordedAt}
                                        placeholder='Select'
                                        options={periodFilterOptions}
                                        onChange={value => {
                                            fetchDetails({'filter[recordedAt]': value.value});
                                        }}
                                        closeMenuOnSelect={true}
                                        formatOptionLabel={(option, {context}) => {
                                            return context === 'menu' ? option.label : option.selectedLabel;
                                        }}
                                    />
                                </div>}
                            />
                            <ActionPanel
                                additionalClasses="dashboard-filters"
                                left={
                                    <Fragment>
                                        <FilterLogo className="filter-logo"/>
                                        <div
                                            styleName="allFiltersWrapper"
                                        >
                                            <div styleName="search-wrapper">
                                                <Input
                                                    classNameInput="search-input"
                                                    type="search"
                                                    value={currentSearch}
                                                    iconName="mi-search"
                                                    placeholder="Search accounts"
                                                    onInput={e => {
                                                        fetchDetails({'filter[accountGroup][description]': e.target.value});
                                                    }}
                                                />
                                            </div>
                                            <IndustryFilter
                                                className="filter-wrapper"
                                                value={selectedIndustries}
                                                onChange={updateIndustries}
                                                placeholder={<span>Industry: <span style={{color: '#333'}}>Any</span></span>}
                                                options={industriesForFilter}
                                            />
                                            <AccountSizeFilter
                                                className="filter-wrapper"
                                                value={selectedSize}
                                                onChange={updateSize}
                                                placeholder={<span>Size: <span style={{color: '#333'}}>Any</span></span>}
                                                options={employeesForFilter}
                                                isMulti={true}
                                            />
                                            <CountryFilter
                                                className="filter-wrapper"
                                                value={selectedCountries}
                                                onChange={updateCountries}
                                                isLinkedIn={true}
                                                placeholder={<span>Country: <span style={{color: '#333'}}>Any</span></span>}
                                                countriesToOption={item => (item ? {value: item.country_id, label: item.country} : {value: 'empty', label: 'empty'})}
                                            />
                                        </div>
                                        <div
                                            styleName={'filter-action-button'}
                                        >
                                            <Button
                                                disabled={isApplyDisabled}
                                                text="Apply"
                                                color="success"
                                                onClick={() => {
                                                    fetchDetails({
                                                        'fields[intentReportData]': selectedIntentReportData?.value,
                                                        'filter[recordedAt]': selectedRecordedAt?.value,
                                                        'filter[accountGroup][description]': currentSearch,
                                                        'filter[accountGroup][industry]': _.map(selectedIndustries, 'value'),
                                                        'filter[accountGroup][country]': _.map(selectedCountries, 'value'),
                                                        'filter[accountGroup][size]': _.map(selectedSize, 'value'),
                                                    });
                                                }}
                                            />
                                            <Button
                                                text="Clear"
                                                color="teal"
                                                className="btn bordered-button"
                                                onClick={() => {
                                                    updateCountries(null);
                                                    updateSize(null);
                                                    updateIndustries(null);
                                                    fetchDetails({
                                                        'filter[accountGroup][industry]': null,
                                                        'filter[accountGroup][country]': null,
                                                        'filter[accountGroup][size]': null,
                                                        'filter[accountGroup][description]': '',
                                                    });
                                                }}
                                            />
                                        </div>
                                    </Fragment>
                                }
                            />
                            {(() => {
                                if (isFetching) return <BlockUI blocking={true} >{notFound}</BlockUI>;
                                else {
                                    return itemsMapped.length === 0 && !isFiltered ? notFound
                                        : <Table
                                            tableMinWidth={1185}
                                            isLoading={isFetching}
                                            columnWidths={sortedColumns.map(item => item.width || 8)}
                                            additionalStyle="campaignList"
                                            wrapperClassNames={['intent-report-details-flat']}
                                            tableClassNames={['chart']}
                                            head={
                                                <TableHead
                                                    columns={sortedColumns}
                                                    orderColumn={orderColumn}
                                                    orderDirection={orderDirection}
                                                    onClickByColumnHeader={sortDetailsReports}
                                                    textAttribute="text"
                                                />
                                            }
                                            body={
                                                <TableBody
                                                    id={'intent-reports-list'}
                                                    items={itemsMapped}
                                                    selectedItem={selectedItem}
                                                    isDropdown={true}
                                                    options={{tooltiped: ['combinedScore', 'scoredIntentTopics', 'scoredGeoLocations']}}
                                                    onUserFocusOnItem={data => {
                                                        userToggleVisibility({});
                                                        toggleReportActions(data);
                                                    }}
                                                    onToggleActions={toggleReportActions}
                                                />
                                            }
                                            bottomPanel={
                                                <TablePanel
                                                    right={
                                                        <Pagination
                                                            selectedPage={_.get(pagination, ['selectedPage'])}
                                                            itemsPerPage={_.get(pagination, ['itemsPerPage'])}
                                                            pageCount={_.get(pagination, ['pageCount'])}
                                                            totalCount={_.get(pagination, ['totalCount']) || 0}
                                                            onSelect={_.get(props, ['actions', 'selectReportDetailsPage'])}
                                                            onChangeItemsPerPage={_.get(props, ['actions', 'changeItemsPerDetailsPage'])}
                                                        />
                                                    }
                                                    rightSize={12}
                                                />
                                            }
                                        />;
                                }
                            })()}
                        </div>
                    </PageContainer>
                </div>
            </div>

        );
    }
}

export default reduxForm({
    form: 'intentReport',
    enableReinitialize: true,
    keepDirtyOnReinitialize: true,
})(connect(mapStateToProps, mapDispatchToProps)(IntentReportDetails));
