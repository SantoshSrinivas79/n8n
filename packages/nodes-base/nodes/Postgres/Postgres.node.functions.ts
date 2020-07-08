import { IDataObject, INodeExecutionData } from 'n8n-workflow';
import pgPromise = require('pg-promise');
import pg = require('pg-promise/typescript/pg-subset');

/**
 * Returns of copy of the items which only contains the json data and
 * of that only the define properties
 *
 * @param {INodeExecutionData[]} items The items to copy
 * @param {string[]} properties The properties it should include
 * @returns
 */
function getItemCopy(
	items: INodeExecutionData[],
	properties: string[],
): IDataObject[] {
	// Prepare the data to insert and copy it to be returned
	let newItem: IDataObject;
	return items.map(item => {
		newItem = {};
		for (const property of properties) {
			if (item.json[property] === undefined) {
				newItem[property] = null;
			} else {
				newItem[property] = JSON.parse(JSON.stringify(item.json[property]));
			}
		}
		return newItem;
	});
}

/**
 * Executes the given SQL query on the database.
 *
 * @param {Function} getNodeParam The getter of the Node
 * @param {pgPromise.IMain<{}, pg.IClient>} pgp The pgPromise instance
 * @param {pgPromise.IDatabase<{}, pg.IClient>} db The pgPromise database connection
 * @param {input[]} input The Node's input data
 * @returns Promise<Array<object>>
 */
export function executeQuery(
	getNodeParam: Function,
	pgp: pgPromise.IMain<{}, pg.IClient>,
	db: pgPromise.IDatabase<{}, pg.IClient>,
	input: INodeExecutionData[],
): Promise<Array<object>> {
	const queries: string[] = [];
	for (let i = 0; i < input.length; i++) {
		queries.push(getNodeParam('query', i) as string);
	}

	return db.any(pgp.helpers.concat(queries));
}

/**
 * Returns of copy of the items which only contains the json data and
 * of that only the define properties
 *
 * @param {Function} getNodeParam The getter of the Node
 * @param {pgPromise.IMain<{}, pg.IClient>} pgp The pgPromise instance
 * @param {pgPromise.IDatabase<{}, pg.IClient>} db The pgPromise database connection
 * @param {input[]} input The Node's input data
 * @returns Promise<object>
 */
export async function executeInsert(
	getNodeParam: Function,
	pgp: pgPromise.IMain<{}, pg.IClient>,
	db: pgPromise.IDatabase<{}, pg.IClient>,
	items: INodeExecutionData[],
): Promise<Array<IDataObject[]>> {
	const table = getNodeParam('table', 0) as string;
	const schema = getNodeParam('schema', 0) as string;
	let returnFields = (getNodeParam('returnFields', 0) as string).split(
		',',
	) as string[];
	const columnString = getNodeParam('columns', 0) as string;
	const columns = columnString.split(',').map(column => column.trim());

	const cs = new pgp.helpers.ColumnSet(columns);

	const te = new pgp.helpers.TableName({ table, schema });

	// Prepare the data to insert and copy it to be returned
	const insertItems = getItemCopy(items, columns);

	// Generate the multi-row insert query and return the id of new row
	returnFields = returnFields
		.map(value => value.trim())
		.filter(value => !!value);
	const query =
		pgp.helpers.insert(insertItems, cs, te) +
		(returnFields.length ? ` RETURNING ${returnFields.join(',')}` : '');

	// Executing the query to insert the data
	const insertData = await db.manyOrNone(query);

	return [insertData, insertItems];
}